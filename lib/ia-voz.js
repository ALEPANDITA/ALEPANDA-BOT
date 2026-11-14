// Voz de las IAs (Pandita, Mei...) con ElevenLabs: convierte el texto en una NOTA DE VOZ de WhatsApp.
//
//  - La clave de ElevenLabs se guarda con:  .setapikey elevenlabs TU_CLAVE   (se pueden poner varias; si una se queda sin
//    creditos pasa a la siguiente).
//  - El id de la voz de cada IA se pone con:  .voz pandita <id>  /  .voz mei <id>  (config.json -> elevenlabs.voces).
//  - Si algo falla (sin clave, sin voz, sin creditos, sin ffmpeg...) generarNotaDeVoz devuelve null y quien la llama manda
//    el texto normal: nunca deja a la IA sin contestar.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { getApiKeys } = require('./apikeys');
const { leerConfig, guardarConfig } = require('./config');

const API = 'https://api.elevenlabs.io/v1';
const MODELO_POR_DEFECTO = 'eleven_flash_v2_5'; // barato (0.5 credito por letra) y habla español bien
const MODELOS_ATAJO = {
  flash: 'eleven_flash_v2_5',
  turbo: 'eleven_turbo_v2_5',
  multilingual: 'eleven_multilingual_v2'
};
const MAX_CARACTERES_VOZ = 700;     // lo que se lee en voz alta como maximo (cuesta creditos por letra)
const PAUSA_SIN_CREDITOS_MS = 15 * 60 * 1000;
const TIMEOUT_API_MS = 25000;

let pausaHasta = 0;       // si todas las claves se quedaron sin creditos, no se insiste por un rato
let ultimoError = null;   // { cuando, mensaje } para .voz estado

// ---------- Configuracion (config.json -> elevenlabs) ----------
function configVoz() {
  const c = leerConfig().elevenlabs || {};
  return {
    activo: c.activo !== false,
    modelo: c.modelo || MODELO_POR_DEFECTO,
    voces: c.voces && typeof c.voces === 'object' ? c.voces : {}
  };
}

function cambiarConfigVoz(cambio) {
  const config = leerConfig();
  const actual = config.elevenlabs || {};
  config.elevenlabs = { ...actual, ...cambio };
  guardarConfig(config);
  return configVoz();
}

function ponerVoz(persona, voiceId) {
  const voces = { ...configVoz().voces, [persona]: voiceId };
  return cambiarConfigVoz({ voces });
}

function resolverModelo(texto) {
  const t = String(texto || '').trim();
  return MODELOS_ATAJO[t.toLowerCase()] || (/^eleven_[a-z0-9_]+$/i.test(t) ? t : null);
}

function vozDe(persona) {
  const { voces } = configVoz();
  return voces[persona] || voces.todas || null;
}

// ---------- Texto -> lo que se va a leer ----------
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu;

// Quita lo que una voz no debe leer: emojis, formato de WhatsApp, enlaces, menciones y marcadores.
// Devuelve { texto, recortado }: recortado = true si se paso del maximo y se cortó (para mandar tambien el texto completo).
function prepararTextoVoz(texto) {
  let t = String(texto || '')
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/@\d{5,}/g, ' ')
    .replace(EMOJI, ' ')
    .replace(/[*_~`>#|]/g, ' ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim();
  let recortado = false;
  if (t.length > MAX_CARACTERES_VOZ) {
    const corte = t.slice(0, MAX_CARACTERES_VOZ);
    const ultimoPunto = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '), corte.lastIndexOf('! '));
    t = (ultimoPunto > MAX_CARACTERES_VOZ * 0.5 ? corte.slice(0, ultimoPunto + 1) : corte).trim();
    recortado = true;
  }
  return { texto: t, recortado };
}

const textoParaVoz = (texto) => prepararTextoVoz(texto).texto;

// ---------- ElevenLabs ----------
function conTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, limpiar: () => clearTimeout(t) };
}

async function pedirMp3(texto, voiceId, modelo, apiKey) {
  const cuerpo = {
    text: texto,
    model_id: modelo,
    voice_settings: { stability: 0.45, similarity_boost: 0.8 }
  };
  if (/v2_5/.test(modelo)) cuerpo.language_code = 'es'; // solo lo aceptan los modelos v2.5

  const espera = conTimeout(TIMEOUT_API_MS);
  try {
    const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(cuerpo),
      signal: espera.signal
    });
    if (!res.ok) {
      let detalle = '';
      try { const j = await res.json(); detalle = (j.detail && (j.detail.status || j.detail.message)) || JSON.stringify(j).slice(0, 200); } catch (_) { /* sin cuerpo */ }
      const err = new Error(`ElevenLabs ${res.status}${detalle ? ': ' + detalle : ''}`);
      err.status = res.status;
      err.detalle = String(detalle);
      throw err;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw new Error('ElevenLabs devolvio un audio vacio');
    return buf;
  } finally {
    espera.limpiar();
  }
}

// mp3 -> nota de voz de WhatsApp (ogg/opus mono)
function mp3ANotaDeVoz(mp3) {
  return new Promise((resolve, reject) => {
    const base = path.join(os.tmpdir(), `iavoz_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const entrada = `${base}.mp3`;
    const salida = `${base}.ogg`;
    const limpiar = () => { for (const f of [entrada, salida]) fs.unlink(f, () => {}); };
    try { fs.writeFileSync(entrada, mp3); } catch (err) { return reject(err); }
    execFile('ffmpeg', ['-y', '-i', entrada, '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip', salida],
      { timeout: 30000 }, (err) => {
        if (err) { limpiar(); return reject(err); }
        try { const ogg = fs.readFileSync(salida); limpiar(); resolve(ogg); } catch (e) { limpiar(); reject(e); }
      });
  });
}

// Devuelve { audio: Buffer(ogg/opus), mimetype, texto } o null si no se pudo (y entonces se manda texto).
async function generarNotaDeVoz(persona, texto) {
  try {
    const cfg = configVoz();
    if (!cfg.activo) return null;
    const voiceId = vozDe(persona);
    if (!voiceId) { registrarError(`Falta el id de la voz de ${persona}: usa .voz ${persona} <id>`); return null; }
    const claves = getApiKeys('elevenlabs');
    if (!claves.length) { registrarError('Falta la clave: usa .setapikey elevenlabs <clave>'); return null; }
    if (Date.now() < pausaHasta) return null;

    const { texto: hablado, recortado } = prepararTextoVoz(texto);
    if (!hablado || hablado.length < 2) return null;

    let mp3 = null;
    let sinCreditos = 0;
    for (const clave of claves) {
      try {
        mp3 = await pedirMp3(hablado, voiceId, cfg.modelo, clave);
        break;
      } catch (err) {
        registrarError(err.message);
        const cuota = err.status === 401 || err.status === 402 || err.status === 429 || /quota|credit|limit/i.test(err.detalle || '');
        if (cuota) { sinCreditos++; continue; } // probar con la siguiente clave
        console.error('[voz]', err.message);
        return null; // voz inexistente, texto invalido, red...: no tiene caso probar otra clave
      }
    }
    if (!mp3) {
      if (sinCreditos === claves.length) { pausaHasta = Date.now() + PAUSA_SIN_CREDITOS_MS; console.error('[voz] Todas las claves de ElevenLabs sin creditos o invalidas: se pasa a texto por 15 min'); }
      return null;
    }

    const audio = await mp3ANotaDeVoz(mp3);
    return { audio, mimetype: 'audio/ogg; codecs=opus', texto: hablado, truncado: recortado };
  } catch (err) {
    registrarError(err.message);
    console.error('[voz] No pude generar la nota de voz:', err && err.message ? err.message : err);
    return null;
  }
}

function registrarError(mensaje) {
  ultimoError = { cuando: Date.now(), mensaje: String(mensaje).slice(0, 300) };
}

// Creditos de la primera clave que responda (para .voz estado). null si no se pudo consultar.
async function consultarCreditos() {
  for (const clave of getApiKeys('elevenlabs')) {
    const espera = conTimeout(10000);
    try {
      const res = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': clave }, signal: espera.signal });
      if (!res.ok) continue;
      const j = await res.json();
      if (typeof j.character_count === 'number' && typeof j.character_limit === 'number') {
        return { usados: j.character_count, limite: j.character_limit, plan: j.tier || null };
      }
    } catch (_) { /* siguiente clave */ } finally { espera.limpiar(); }
  }
  return null;
}

function estado() {
  const cfg = configVoz();
  return {
    activo: cfg.activo,
    modelo: cfg.modelo,
    voces: cfg.voces,
    claves: getApiKeys('elevenlabs').length,
    enPausaHasta: pausaHasta > Date.now() ? pausaHasta : 0,
    ultimoError
  };
}

function reanudar() { pausaHasta = 0; }

// ¿Esta persona puede contestar con voz ahorita? (activo, tiene id de voz, hay clave y no esta en pausa por falta de creditos)
function disponible(persona) {
  try {
    return configVoz().activo && !!vozDe(persona) && getApiKeys('elevenlabs').length > 0 && Date.now() >= pausaHasta;
  } catch (_) { return false; }
}

// Voces de la cuenta (id + nombre) para .voz voces. Puede fallar si la clave no tiene permiso de leer voces.
async function listarVoces() {
  for (const clave of getApiKeys('elevenlabs')) {
    const espera = conTimeout(12000);
    try {
      const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': clave }, signal: espera.signal });
      if (!res.ok) continue;
      const j = await res.json();
      return (j.voices || []).map((v) => ({ id: v.voice_id, nombre: v.name, categoria: v.category || '' }));
    } catch (_) { /* siguiente clave */ } finally { espera.limpiar(); }
  }
  return null;
}

module.exports = {
  generarNotaDeVoz, textoParaVoz, consultarCreditos, estado, reanudar, disponible, listarVoces,
  configVoz, cambiarConfigVoz, ponerVoz, resolverModelo, vozDe,
  MAX_CARACTERES_VOZ, MODELO_POR_DEFECTO, MODELOS_ATAJO
};

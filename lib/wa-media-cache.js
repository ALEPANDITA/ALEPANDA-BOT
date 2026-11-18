'use strict';
// Recuerda el "recibo" de subida que WhatsApp le da al bot cuando manda un audio.
// Si la misma cancion se pide otra vez, en vez de leer el mp3 y SUBIRLO de nuevo a
// WhatsApp (lo lento), se reenvia con ese recibo y llega casi al instante.
//
// Funciona igual que cuando reenvias un audio en WhatsApp: el archivo ya esta en los
// servidores de WhatsApp y solo se manda la referencia. Si no hay recibo, esta vencido
// o algo falla, el bot hace lo de siempre (subir el archivo), asi que no se rompe nada.
//
// Se guarda al lado de la cache de canciones: cache-musica/<id>.mp3.wa.json
// (.limpiarcache tambien lo borra, porque vacia toda esa carpeta).
//
// Variable opcional en .env:  WA_MEDIA_TTL_DIAS=7   (dias que se confia en el recibo; 0 = desactivado)
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache-musica');
const DIAS = process.env.WA_MEDIA_TTL_DIAS === undefined || process.env.WA_MEDIA_TTL_DIAS === ''
  ? 7
  : Number(process.env.WA_MEDIA_TTL_DIAS);
const TTL_MS = (Number.isFinite(DIAS) && DIAS > 0 ? DIAS : 0) * 24 * 60 * 60 * 1000;

// Campos del audioMessage que hacen falta para reenviarlo; los 3 primeros son binarios.
const BINARIOS = ['mediaKey', 'fileSha256', 'fileEncSha256'];
const NUMEROS = ['fileLength', 'mediaKeyTimestamp', 'seconds'];
const TEXTOS = ['url', 'directPath', 'mimetype'];

function archivoDe(id) {
  return path.join(CACHE_DIR, `${id}.mp3.wa.json`);
}

function aNumero(v) {
  if (v == null) return undefined;
  if (typeof v.toNumber === 'function') return v.toNumber(); // Long de protobuf
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Guarda el recibo a partir de lo que devuelve sock.sendMessage(...). Nunca lanza error.
function guardar(id, enviado) {
  if (!TTL_MS || !id) return;
  try {
    const a = enviado && enviado.message && enviado.message.audioMessage;
    if (!a) return;
    const reg = { guardado: Date.now() };
    for (const k of BINARIOS) {
      if (!a[k] || !a[k].length) return;
      reg[k] = Buffer.from(a[k]).toString('base64');
    }
    for (const k of TEXTOS) if (a[k]) reg[k] = String(a[k]);
    for (const k of NUMEROS) { const n = aNumero(a[k]); if (n !== undefined) reg[k] = n; }
    if (!reg.directPath || !reg.fileLength) return;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const destino = archivoDe(id);
    fs.writeFileSync(destino + '.tmp', JSON.stringify(reg));
    fs.renameSync(destino + '.tmp', destino);
  } catch (err) {
    console.error('[wa-media-cache] no se pudo guardar el recibo:', err.message);
  }
}

function borrar(id) {
  try { fs.unlinkSync(archivoDe(id)); } catch (_) {}
}

// Devuelve el audioMessage listo para reenviar, o null si no hay recibo vigente.
function leer(id) {
  if (!TTL_MS || !id) return null;
  try {
    const reg = JSON.parse(fs.readFileSync(archivoDe(id), 'utf8'));
    if (!reg.guardado || Date.now() - reg.guardado > TTL_MS) { borrar(id); return null; }
    const audio = {};
    for (const k of BINARIOS) {
      if (!reg[k]) { borrar(id); return null; }
      audio[k] = Buffer.from(reg[k], 'base64');
    }
    for (const k of TEXTOS) if (reg[k]) audio[k] = reg[k];
    for (const k of NUMEROS) if (reg[k] !== undefined) audio[k] = reg[k];
    return audio;
  } catch (_) { return null; }
}

// Reenvia el audio ya subido. Devuelve true si se mando, false si no habia recibo
// (o si el reenvio fallo; en ese caso el recibo se descarta para no insistir).
async function reenviar(sock, jid, id) {
  const audio = leer(id);
  if (!audio) return false;
  try {
    await sock.sendMessage(jid, {
      forward: { key: { fromMe: true }, message: { audioMessage: audio } }
    });
    return true;
  } catch (err) {
    console.error('[wa-media-cache] el reenvio fallo, se sube de nuevo:', err.message);
    borrar(id);
    return false;
  }
}

module.exports = { guardar, leer, borrar, reenviar };

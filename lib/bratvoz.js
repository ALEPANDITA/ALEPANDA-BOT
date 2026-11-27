'use strict';
// Brat animado con voz (.brat audio texto): hoja blanca, las palabras van apareciendo al ritmo de la voz
// y sale como sticker CON SONIDO (se manda igual que .sa: lib/stickersonido.js -> enviarSonoro).
// Voz: espeak-ng (local, gratis y sin limite). Instalar en el VPS:  apt install -y espeak-ng
// Cada palabra se sintetiza por separado: asi cada cuadro del WebP dura exactamente lo que dura su palabra
// y el audio y la animacion salen con la misma duracion.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const { addExif, PACKNAME_POR_DEFECTO, AUTOR_POR_DEFECTO } = require('./stickerlib');
const { leerOggOpus } = require('./stickersonido');

const execFileAsync = promisify(execFile);
const MAX_CARACTERES = 300;
const SEGUNDOS_MAX = 15;               // igual que .sa
const PESO_MAX_WEBP = 900 * 1024;      // igual que .sa
const AUDIO_MAX_BYTES = 128 * 1024;    // limite del audio que acepta iPhone
const BITRATES = [48, 32, 24];
const CALIDADES = [70, 50, 35];        // calidad del WebP: se baja hasta que cabe
const LADO = 512;
const MARGEN = 30;
const FUENTE = 68;                     // px (la hoja de brat)
const ESCALA_X = 0.86;                 // letra un poco angosta, como el brat original
const INTERLINEA = 1.12;
const MS_MIN_CUADRO = 130;             // los visores no respetan cuadros mas cortos
const PAUSA_MS = 45;                   // respiro entre palabras
const COLA_MS = 700;                   // el ultimo cuadro (texto completo) se queda un momento antes de repetir
// Voces de espeak-ng. "probar" = nombres de voz en orden; se usa el primero que el servidor tenga (m1-m7 hombre, f1-f5 mujer).
// vel = palabras por minuto, tono = 0-99. Las de otros idiomas leen el texto en español con acento (para reirse).
const VOCES = {
  jorge:     { nombre: 'Jorge, hombre (la de siempre)', probar: ['es-419+m3', 'es-419', 'es'], vel: 165, tono: 40 },
  grave:     { nombre: 'Grave, hombre profundo', probar: ['es-419+m7', 'es-419+m1', 'es-419', 'es'], vel: 150, tono: 15 },
  mujer:     { nombre: 'Mujer', probar: ['es-419+f3', 'es-419+f2', 'es-419', 'es'], vel: 170, tono: 55 },
  aguda:     { nombre: 'Aguda, chillona y rapida', probar: ['es-419+f4', 'es-419+f3', 'es-419', 'es'], vel: 205, tono: 95 },
  monstruo:  { nombre: 'Monstruo, ronca', probar: ['es-419+croak', 'es-419+m7', 'es-419', 'es'], vel: 135, tono: 10 },
  susurro:   { nombre: 'Susurro', probar: ['es-419+whisper', 'es-419', 'es'], vel: 150, tono: 50 },
  espana:    { nombre: 'Espana (acento de Espana)', probar: ['es+m3', 'es'], vel: 165, tono: 40 },
  gringo:    { nombre: 'Gringo (ingles leyendo español)', probar: ['en-us+m3', 'en-us', 'en'], vel: 165, tono: 40 },
  italiano:  { nombre: 'Italiano', probar: ['it+m3', 'it'], vel: 170, tono: 45 },
  frances:   { nombre: 'Frances', probar: ['fr-fr+m3', 'fr+m3', 'fr'], vel: 165, tono: 45 },
  portugues: { nombre: 'Portugues', probar: ['pt-br+m3', 'pt+m3', 'pt'], vel: 165, tono: 45 },
  aleman:    { nombre: 'Aleman', probar: ['de+m3', 'de'], vel: 160, tono: 40 },
  // MBROLA: voces locales mas naturales (apt install mbrola mbrola-es1 mbrola-es2 ...). Si no estan instaladas, suena la de jorge.
  mb1:       { nombre: 'MBROLA 1 (mas natural)', probar: ['mb-es1', 'es-419+m3', 'es-419', 'es'], vel: 165, tono: 50 },
  mb2:       { nombre: 'MBROLA 2 (mas natural)', probar: ['mb-es2', 'es-419+m3', 'es-419', 'es'], vel: 165, tono: 50 },
  mb3:       { nombre: 'MBROLA 3 (mas natural)', probar: ['mb-es3', 'es-419+f3', 'es-419', 'es'], vel: 165, tono: 50 },
  mb4:       { nombre: 'MBROLA 4 (mas natural)', probar: ['mb-es4', 'es-419+m3', 'es-419', 'es'], vel: 165, tono: 50 }
};
const VOZ_POR_DEFECTO = 'jorge';
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// otras formas de decirlas
const SINONIMOS = { hombre: 'jorge', chico: 'jorge', mujer: 'mujer', chica: 'mujer', ardilla: 'aguda', chillona: 'aguda', ronca: 'monstruo', robot: 'monstruo', whisper: 'susurro', ingles: 'gringo', usa: 'gringo', italia: 'italiano', francia: 'frances', brasil: 'portugues', alemania: 'aleman', spain: 'espana' };
// "Gringo", "ESPAÑA" -> clave de la tabla (o null si no existe)
function resolverVoz(nombre) { const k = sinAcentos(nombre).replace(/[^a-z]/g, ''); return VOCES[k] ? k : (SINONIMOS[k] || null); }
const TMP = path.join(os.tmpdir(), 'alepanda-brat-voz');

// ---- cola: una a la vez (el VPS es justo de CPU) ----
let ocupado = false;
const espera = [];
function turno() { return new Promise((ok) => { const go = () => { ocupado = true; ok(); }; ocupado ? espera.push(go) : go(); }); }
function soltar() { const s = espera.shift(); if (s) s(); else ocupado = false; }

const borrar = (...r) => { for (const x of r) { try { fs.unlinkSync(x); } catch (_) { /* nada */ } } };
const ff = (args) => execFileAsync('ffmpeg', ['-y', '-nostdin', '-loglevel', 'error', '-threads', '2', ...args], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

// ---------------- texto ----------------
function palabrasDe(texto) {
  const limpio = String(texto || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) throw new Error('TEXTO_VACIO');
  if (limpio.length > MAX_CARACTERES) throw new Error('TEXTO_LARGO');
  const out = [];
  for (const p of limpio.split(' ')) {
    if (p.length <= 18) out.push(p);
    else for (let i = 0; i < p.length; i += 14) out.push(p.slice(i, i + 14)); // palabras kilometricas: se parten
  }
  return out;
}

// ---------------- voz ----------------
const vozBuena = {}; // por voz: el nombre de espeak-ng que si funciono en este servidor
function sintetizar(palabra, nombreVoz, cfg) {
  return new Promise((ok, mal) => {
    const p = spawn('espeak-ng', ['-v', nombreVoz, '-s', String(cfg.vel), '-p', String(cfg.tono), '-a', '150', '--stdin', '--stdout'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const salida = []; let errTxt = '';
    p.stdout.on('data', (d) => salida.push(d));
    p.stderr.on('data', (d) => { errTxt += d; });
    p.on('error', mal);
    p.on('close', (codigo) => (codigo === 0 && salida.length ? ok(Buffer.concat(salida)) : mal(new Error(`espeak-ng ${codigo}: ${errTxt.slice(0, 120)}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(`${palabra}\n`);
  });
}
// Devuelve { hz, pcm } ya leido, o null si ninguna voz pudo decir la palabra (se queda en silencio, no se cae todo).
// Una voz que devuelve audio vacio (por ejemplo MBROLA sin instalar) cuenta como fallida y se prueba la siguiente.
async function hablar(palabra, clave) {
  const cfg = VOCES[clave];
  const voces = vozBuena[clave] ? [vozBuena[clave]] : cfg.probar;
  let ultimo = null;
  for (const v of voces) {
    try {
      const w = leerWav(await sintetizar(palabra, v, cfg));
      if (w.pcm.length < 200) { ultimo = new Error('VACIO'); continue; }
      vozBuena[clave] = v;
      return w;
    } catch (e) {
      if (e && e.code === 'ENOENT') throw new Error('SIN_VOZ');
      ultimo = e;
    }
  }
  if (ultimo && ultimo.message === 'VACIO') return null;
  throw ultimo || new Error('No se pudo sintetizar la voz.');
}

function leerWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('La voz no devolvio un WAV valido.');
  let hz = 22050; let bits = 16; let canales = 1; let datos = null;
  for (let i = 12; i + 8 <= buf.length;) {
    const id = buf.toString('ascii', i, i + 4);
    let tam = buf.readUInt32LE(i + 4);
    const d = i + 8;
    if (id === 'fmt ') { canales = buf.readUInt16LE(d + 2); hz = buf.readUInt32LE(d + 4); bits = buf.readUInt16LE(d + 14); }
    else if (id === 'data') { if (tam === 0 || d + tam > buf.length) tam = buf.length - d; datos = buf.subarray(d, d + tam); break; } // por stdout el largo puede venir en 0 o de mas
    i = d + tam + (tam % 2);
  }
  if (!datos || bits !== 16 || canales !== 1) throw new Error('La voz devolvio un audio que no es mono de 16 bits.');
  const n = Math.floor(datos.length / 2);
  const pcm = new Int16Array(n);
  for (let k = 0; k < n; k++) pcm[k] = datos.readInt16LE(k * 2);
  return { hz, pcm };
}

// quita el silencio de los extremos (deja un respiro de 12 ms)
function recortar(pcm, hz) {
  const umbral = 300; const n = pcm.length;
  let ini = 0; while (ini < n && Math.abs(pcm[ini]) < umbral) ini++;
  if (ini >= n) return new Int16Array(0);
  let fin = n; while (fin > ini && Math.abs(pcm[fin - 1]) < umbral) fin--;
  const m = Math.round(hz * 0.012);
  return pcm.subarray(Math.max(0, ini - m), Math.min(n, fin + m));
}

function wavDe(pcm, hz) {
  const datos = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) datos.writeInt16LE(pcm[i], i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + datos.length, 4); h.write('WAVE', 8, 'ascii'); h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(hz, 24); h.writeUInt32LE(hz * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii'); h.writeUInt32LE(datos.length, 40);
  return Buffer.concat([h, datos]);
}

// Habla cada palabra y arma la linea de tiempo: { hz, pcm (todo el audio), duraciones (ms por palabra, ultima incluye la cola) }
async function lineaDeTiempo(palabras, clave) {
  let hz = 0;
  const trozos = [];
  for (const p of palabras) {
    const hablable = p.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    let pcm = new Int16Array(0);
    if (hablable) {
      const w = await hablar(hablable, clave);
      if (w) { if (!hz) hz = w.hz; pcm = recortar(w.pcm, w.hz); }
    }
    trozos.push(pcm);
  }
  if (!hz) hz = 22050;
  const segmentos = trozos.map((pcm) => {
    const ms = Math.max(MS_MIN_CUADRO, Math.round((pcm.length / hz) * 1000) + PAUSA_MS);
    return { pcm, muestras: Math.round((ms * hz) / 1000) };
  });
  segmentos[segmentos.length - 1].muestras += Math.round((COLA_MS * hz) / 1000);
  const total = segmentos.reduce((a, s) => a + s.muestras, 0);
  const pcm = new Int16Array(total);
  const duraciones = []; let pos = 0; let msAntes = 0;
  for (const s of segmentos) {
    pcm.set(s.pcm.subarray(0, Math.min(s.pcm.length, s.muestras)), pos);
    pos += s.muestras;
    const msHasta = Math.round((pos / hz) * 1000); // se acumula para que la suma de cuadros sea exacta
    duraciones.push(msHasta - msAntes); msAntes = msHasta;
  }
  // volumen parejo: el pico llega a ~85 %
  let pico = 0; for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > pico) pico = a; }
  if (pico > 0) { const g = (0.85 * 32767) / pico; for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * g))); }
  return { hz, pcm, duraciones, totalMs: msAntes };
}

// ---------------- dibujo ----------------
let canvasLib = null;
function cargarCanvas() {
  if (canvasLib) return canvasLib;
  const lib = require('@napi-rs/canvas');
  const ruta = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
  try { if (fs.existsSync(ruta)) lib.GlobalFonts.registerFromPath(ruta, 'BratSans'); } catch (_) { /* usa la del sistema */ }
  canvasLib = lib;
  return lib;
}
const FUENTE_CSS = (px) => `${px}px BratSans, Arial, sans-serif`;

// En que hoja y en que lugar cae cada palabra. Si la hoja se llena, se limpia y sigue en otra.
function distribuir(ctx, palabras) {
  const anchoMax = LADO - 2 * MARGEN;
  const medir = (t, px) => { ctx.font = FUENTE_CSS(px); return ctx.measureText(t).width * ESCALA_X; };
  let px = FUENTE;
  const mayor = Math.max(...palabras.map((p) => medir(p, px)));
  if (mayor > anchoMax) px = Math.max(30, Math.floor((px * anchoMax) / mayor)); // que la palabra mas larga quepa
  const alto = Math.round(px * INTERLINEA);
  const filasMax = Math.max(1, Math.floor((LADO - 2 * MARGEN) / alto));
  const espacio = medir(' ', px);
  let hoja = 0; let fila = 0; let x = 0;
  const lugares = palabras.map((p) => {
    const w = medir(p, px);
    if (x > 0 && x + w > anchoMax) { fila++; x = 0; }
    if (fila >= filasMax) { hoja++; fila = 0; x = 0; }
    const lugar = { hoja, x, y: fila * alto };
    x += w + espacio;
    return lugar;
  });
  return { px, lugares };
}

function dibujarCuadro(ctx, palabras, dis, i) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, LADO, LADO);
  ctx.filter = 'blur(1.3px)';
  ctx.fillStyle = '#000000'; ctx.textBaseline = 'top'; ctx.font = FUENTE_CSS(dis.px);
  const hoja = dis.lugares[i].hoja;
  for (let j = 0; j <= i; j++) {
    if (dis.lugares[j].hoja !== hoja) continue;
    ctx.save();
    ctx.translate(MARGEN + dis.lugares[j].x, MARGEN + dis.lugares[j].y);
    ctx.scale(ESCALA_X, 1);
    ctx.fillText(palabras[j], 0, 0);
    ctx.restore();
  }
}

// ---------------- WebP animado (se arma a mano: cada cuadro con su duracion exacta) ----------------
function trozo(id, datos) {
  const h = Buffer.alloc(8); h.write(id, 0, 'ascii'); h.writeUInt32LE(datos.length, 4);
  return Buffer.concat([h, datos, datos.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
// los trozos de imagen (ALPH, VP8, VP8L) de un WebP suelto
function imagenDe(webp) {
  const out = [];
  for (let i = 12; i + 8 <= webp.length;) {
    const id = webp.toString('ascii', i, i + 4);
    const tam = webp.readUInt32LE(i + 4);
    const fin = i + 8 + tam + (tam % 2);
    if (id === 'VP8 ' || id === 'VP8L' || id === 'ALPH') out.push(webp.subarray(i, Math.min(fin, webp.length)));
    i = fin;
  }
  if (!out.length) throw new Error('El cuadro WebP salio vacio.');
  return Buffer.concat(out);
}
function armarAnimado(cuadros) {
  const vp8x = Buffer.alloc(10); vp8x[0] = 0x02; vp8x.writeUIntLE(LADO - 1, 4, 3); vp8x.writeUIntLE(LADO - 1, 7, 3);
  const anim = Buffer.alloc(6); anim.writeUInt32LE(0xffffffff, 0); anim.writeUInt16LE(0, 4); // fondo blanco, repite siempre
  const partes = [trozo('VP8X', vp8x), trozo('ANIM', anim)];
  for (const c of cuadros) {
    const h = Buffer.alloc(16);
    h.writeUIntLE(0, 0, 3); h.writeUIntLE(0, 3, 3); h.writeUIntLE(LADO - 1, 6, 3); h.writeUIntLE(LADO - 1, 9, 3);
    h.writeUIntLE(c.ms, 12, 3); h[15] = 0x02; // sin mezclar con el cuadro anterior
    partes.push(trozo('ANMF', Buffer.concat([h, imagenDe(c.webp)])));
  }
  const cuerpo = Buffer.concat(partes);
  const cab = Buffer.alloc(12); cab.write('RIFF', 0, 'ascii'); cab.writeUInt32LE(4 + cuerpo.length, 4); cab.write('WEBP', 8, 'ascii');
  return Buffer.concat([cab, cuerpo]);
}

function hacerWebp(palabras, duraciones) {
  const lib = cargarCanvas();
  const cv = lib.createCanvas(LADO, LADO); const ctx = cv.getContext('2d');
  const dis = distribuir(ctx, palabras);
  for (const q of CALIDADES) { // si pesa mucho, se vuelve a dibujar con menos calidad
    const cuadros = palabras.map((_, i) => {
      dibujarCuadro(ctx, palabras, dis, i);
      return { webp: cv.toBuffer('image/webp', q), ms: duraciones[i] };
    });
    const w = armarAnimado(cuadros);
    if (w.length <= PESO_MAX_WEBP - 12 * 1024) return w; // se deja lugar al EXIF
  }
  throw new Error('El sticker quedo muy pesado, prueba con un texto mas corto.');
}

// ---------------- audio ----------------
async function hacerOgg(pcm, hz, totalMs, wavRuta, oggRuta) {
  fs.writeFileSync(wavRuta, wavDe(pcm, hz));
  for (const kbps of BITRATES) {
    await ff(['-i', wavRuta, '-t', (totalMs / 1000).toFixed(3), '-af', 'asetpts=PTS-STARTPTS,aresample=48000:async=1:first_pts=0,apad',
      '-c:a', 'libopus', '-application', 'voip', '-b:a', `${kbps}k`, '-vbr', 'on', '-compression_level', '10',
      '-ac', '1', '-ar', '48000', '-map_metadata', '-1', '-f', 'ogg', oggRuta]);
    const b = fs.readFileSync(oggRuta);
    if (b.length <= AUDIO_MAX_BYTES && leerOggOpus(b)) return b;
  }
  throw new Error('El audio quedo muy pesado, prueba con un texto mas corto.');
}

// Devuelve { webp, ogg, segundos, palabras, duracionMs }, listo para enviarSonoro().
// voz: una clave de VOCES (jorge, grave, mujer...). Errores con codigo: TEXTO_VACIO, TEXTO_LARGO, MUY_LARGO, SIN_VOZ
async function crearBratConVoz(texto, { packname = PACKNAME_POR_DEFECTO, author = AUTOR_POR_DEFECTO, voz = VOZ_POR_DEFECTO } = {}) {
  const clave = VOCES[voz] ? voz : VOZ_POR_DEFECTO;
  const palabras = palabrasDe(texto);
  fs.mkdirSync(TMP, { recursive: true });
  await turno();
  const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const wavRuta = path.join(TMP, `${id}.wav`); const oggRuta = path.join(TMP, `${id}.ogg`);
  try {
    const t = await lineaDeTiempo(palabras, clave);
    if (t.totalMs > SEGUNDOS_MAX * 1000) throw new Error('MUY_LARGO');
    const webpCrudo = hacerWebp(palabras, t.duraciones);
    const ogg = await hacerOgg(t.pcm, t.hz, t.totalMs, wavRuta, oggRuta);
    const info = leerOggOpus(ogg);
    const segundos = Math.max(1, Math.ceil(Math.max(t.totalMs, info ? info.duracionMs : 0) / 1000));
    const webp = await addExif(webpCrudo, packname, author);
    return { webp, ogg, segundos, palabras: palabras.length, duracionMs: t.totalMs };
  } finally {
    borrar(wavRuta, oggRuta);
    soltar();
  }
}

module.exports = { crearBratConVoz, resolverVoz, VOCES, VOZ_POR_DEFECTO, MAX_CARACTERES, SEGUNDOS_MAX };

// Libreria de stickers (adaptada de la version TypeScript que te pasaron).
// - Convierte imagen / video / gif a sticker WebP con ffmpeg.
// - Le pone nombre de paquete y autor (EXIF) con node-webpmux.
// - Maximo 2 conversiones de ffmpeg al mismo tiempo para no ahogar el VPS.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Cambia aqui el paquete y el autor que salen por defecto en los stickers
const PACKNAME_POR_DEFECTO = '🐼 ALEPANDA BOT 🐼';
const AUTOR_POR_DEFECTO = '👤 Creado por:';

const TMP = path.join(os.tmpdir(), 'alepanda-stickers');
const PESO_MAXIMO_ANIMADO = 900 * 1024; // WhatsApp rechaza stickers animados muy pesados

// ───────── Cola simple (maximo 2 conversiones a la vez) ─────────
const MAX_PARALELOS = 2;
let activos = 0;
const espera = [];

function enCola(tarea) {
  return new Promise((resolve, reject) => {
    const correr = async () => {
      activos++;
      try {
        resolve(await tarea());
      } catch (err) {
        reject(err);
      } finally {
        activos--;
        const siguiente = espera.shift();
        if (siguiente) siguiente();
      }
    };
    if (activos < MAX_PARALELOS) correr();
    else espera.push(correr);
  });
}

function nombreTemporal(ext) {
  fs.mkdirSync(TMP, { recursive: true });
  return path.join(TMP, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
}

function borrar(...rutas) {
  for (const r of rutas) fs.promises.unlink(r).catch(() => {});
}

// ───────── EXIF (nombre del paquete y autor) ─────────
let modWebp = null;
function cargarWebp() {
  if (!modWebp) {
    const m = require('node-webpmux');
    modWebp = m.Image ? m : (m.default || m);
  }
  return modWebp;
}

async function addExif(webpBuffer, packname, author) {
  try {
    const webp = cargarWebp();
    const img = new webp.Image();
    const json = {
      'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
      'sticker-pack-name': packname,
      'sticker-pack-publisher': author,
      emojis: ['']
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(webpBuffer);
    img.exif = exif;
    return await img.save(null);
  } catch (err) {
    // Si falta node-webpmux o algo falla, el sticker sale igual, solo que sin nombre de paquete
    console.error('[stickerlib] No se pudo poner el paquete/autor:', err.message);
    return webpBuffer;
  }
}

// ───────── Conversiones con ffmpeg ─────────
const FILTRO_BASE = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba';

function imagenAWebp(buffer) {
  return enCola(async () => {
    const entrada = nombreTemporal('img');
    const salida = nombreTemporal('webp');
    try {
      await fs.promises.writeFile(entrada, buffer);
      await execFileAsync('ffmpeg', [
        '-y', '-nostdin', '-i', entrada, '-frames:v', '1',
        '-vf', FILTRO_BASE,
        '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-an', salida
      ], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
      return await fs.promises.readFile(salida);
    } finally {
      borrar(entrada, salida);
    }
  });
}

// Si el sticker animado queda muy pesado, se reintenta con menos calidad/duracion
const INTENTOS_VIDEO = [
  { seg: 6, fps: 15, calidad: 30 },
  { seg: 5, fps: 12, calidad: 18 },
  { seg: 4, fps: 10, calidad: 10 }
];

function videoAWebp(buffer) {
  return enCola(async () => {
    const entrada = nombreTemporal('mp4');
    const salida = nombreTemporal('webp');
    try {
      await fs.promises.writeFile(entrada, buffer);
      let resultado = null;
      for (const intento of INTENTOS_VIDEO) {
        await execFileAsync('ffmpeg', [
          '-y', '-nostdin', '-threads', '2', '-i', entrada, '-t', String(intento.seg),
          '-vf', `fps=${intento.fps},${FILTRO_BASE}`,
          '-c:v', 'libwebp', '-q:v', String(intento.calidad), '-compression_level', '6',
          '-preset', 'default', '-loop', '0', '-an', salida
        ], { timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
        resultado = await fs.promises.readFile(salida);
        if (resultado.length <= PESO_MAXIMO_ANIMADO) return resultado;
      }
      throw new Error('El sticker animado quedo muy pesado, prueba con un video mas corto.');
    } finally {
      borrar(entrada, salida);
    }
  });
}

// opciones: { animado, packname, author, yaEsSticker }
async function crearSticker(mediaBuffer, opciones = {}) {
  const {
    animado = false,
    packname = PACKNAME_POR_DEFECTO,
    author = AUTOR_POR_DEFECTO,
    yaEsSticker = false
  } = opciones;

  let webpBuffer;
  if (yaEsSticker) webpBuffer = mediaBuffer;
  else if (animado) webpBuffer = await videoAWebp(mediaBuffer);
  else webpBuffer = await imagenAWebp(mediaBuffer);

  return addExif(webpBuffer, packname, author);
}

module.exports = { crearSticker, addExif, PACKNAME_POR_DEFECTO, AUTOR_POR_DEFECTO };

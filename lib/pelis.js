const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const CATALOGO_PATH = path.join(__dirname, '..', 'pelis.json');
const DIAS_VENCIMIENTO_DEFAULT = 20; // WhatsApp suele tirar los archivos por ahi de las 2-3 semanas

// --- Serializacion segura (los mensajes de video traen Buffers -- mediaKey,
// fileEncSha256, etc. -- que JSON.stringify normal no puede reconstruir bien) ---
function serializar(datos) {
  return JSON.stringify(datos, (_key, value) => {
    if (Buffer.isBuffer(value)) return { __buf: value.toString('base64') };
    if (value instanceof Uint8Array) return { __buf: Buffer.from(value).toString('base64') };
    return value;
  }, 2);
}

function deserializar(json) {
  return JSON.parse(json, (_key, value) => {
    if (value && typeof value === 'object' && typeof value.__buf === 'string') {
      return Buffer.from(value.__buf, 'base64');
    }
    return value;
  });
}

function leerCatalogo() {
  if (!fs.existsSync(CATALOGO_PATH)) {
    return { siguienteNumero: 1, peliculas: [] };
  }
  try {
    const data = deserializar(fs.readFileSync(CATALOGO_PATH, 'utf-8'));
    if (!data.peliculas) data.peliculas = [];
    if (!data.siguienteNumero) data.siguienteNumero = 1;
    return data;
  } catch (e) {
    console.error('[pelis] catalogo corrupto, empezando uno nuevo:', e.message);
    return { siguienteNumero: 1, peliculas: [] };
  }
}

function guardarCatalogo(data) {
  fs.writeFileSync(CATALOGO_PATH, serializar(data));
}

function agregarPelicula({ nombre, mimetype, tamano, key, videoMessage }) {
  const data = leerCatalogo();
  const numero = data.siguienteNumero;
  data.peliculas.push({
    numero,
    nombre: nombre || `video_${numero}.mp4`,
    mimetype: mimetype || 'video/mp4',
    tamano: tamano || 0,
    fecha: Date.now(),
    key,
    videoMessage
  });
  data.siguienteNumero = numero + 1;
  guardarCatalogo(data);
  return numero;
}

function listarPeliculas() {
  return leerCatalogo().peliculas;
}

function obtenerPelicula(numero) {
  const n = parseInt(numero, 10);
  return leerCatalogo().peliculas.find(p => p.numero === n);
}

function eliminarPelicula(numero) {
  const n = parseInt(numero, 10);
  const data = leerCatalogo();
  const antes = data.peliculas.length;
  data.peliculas = data.peliculas.filter(p => p.numero !== n);
  guardarCatalogo(data);
  return data.peliculas.length < antes;
}

// Purga por fecha, SIN descargar nada -- rapido y no gasta ancho de banda.
// Se llama automaticamente cada vez que alguien pide .pelis (la lista).
function purgarVencidas(diasLimite = DIAS_VENCIMIENTO_DEFAULT) {
  const data = leerCatalogo();
  const limiteMs = diasLimite * 24 * 60 * 60 * 1000;
  const ahora = Date.now();
  const antes = data.peliculas.length;
  data.peliculas = data.peliculas.filter(p => (ahora - p.fecha) < limiteMs);
  const eliminadas = antes - data.peliculas.length;
  if (eliminadas > 0) guardarCatalogo(data);
  return eliminadas;
}

function formatearTamano(bytes) {
  if (!bytes) return 'desconocido';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Chequeo LIGERO: pide el video como stream y solo lee el primer pedacito
// (unos 64KB) para confirmar que WhatsApp todavia lo tiene -- despues corta
// la conexion, sin bajar el resto del archivo. Esto es lo que usa .pelischeck
// para revisar el catalogo completo sin gastar RAM ni datos de mas.
async function estaViva(pelicula) {
  let stream;
  try {
    stream = await downloadContentFromMessage(pelicula.videoMessage, 'video');
    for await (const chunk of stream) {
      if (chunk && chunk.length > 0) {
        return true; // ya llego algo real -> el archivo sigue vivo
      }
      break;
    }
    return false;
  } catch (e) {
    return false;
  } finally {
    // Cortamos el stream si sigue abierto, para no seguir bajando de mas.
    if (stream && typeof stream.destroy === 'function') {
      try { stream.destroy(); } catch (e) { /* ya estaba cerrado */ }
    }
  }
}

module.exports = {
  leerCatalogo,
  guardarCatalogo,
  agregarPelicula,
  listarPeliculas,
  obtenerPelicula,
  eliminarPelicula,
  purgarVencidas,
  formatearTamano,
  estaViva,
  DIAS_VENCIMIENTO_DEFAULT
};

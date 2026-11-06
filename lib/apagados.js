// lib/apagados.js
//
// Grupos donde el bot esta "apagado" (comando .apagar): ahi no responde a nadie
// (ni comandos, ni IAs, ni juegos, ni moderacion, ni bienvenidas). Solo un owner
// puede volver a encenderlo con .encender.
//
// Se guarda en grupos-apagados.json y se vuelve a leer solo si el archivo cambia.

const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', 'grupos-apagados.json');

let grupos = {}; // jid -> { nombre, desde, por }
let mtimeLeido = -1;

function recargarSiCambio() {
  let mtime = 0;
  try { mtime = fs.statSync(ARCHIVO).mtimeMs; } catch (_) { mtime = 0; }
  if (mtime === mtimeLeido) return;
  mtimeLeido = mtime;
  if (!mtime) { grupos = {}; return; }
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVO, 'utf-8'));
    grupos = data && typeof data.grupos === 'object' && data.grupos ? data.grupos : {};
  } catch (err) {
    console.error('[apagados] no se pudo leer grupos-apagados.json:', err.message);
    grupos = {};
  }
}

function guardar() {
  try {
    const tmp = `${ARCHIVO}.tmp${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ grupos }, null, 2));
    fs.renameSync(tmp, ARCHIVO);
    mtimeLeido = fs.statSync(ARCHIVO).mtimeMs;
  } catch (err) {
    console.error('[apagados] no se pudo guardar:', err.message);
  }
}

function estaApagado(jid) {
  recargarSiCambio();
  return Object.prototype.hasOwnProperty.call(grupos, jid);
}

function apagar(jid, { nombre, por } = {}) {
  recargarSiCambio();
  grupos[jid] = { nombre: nombre || '', desde: Date.now(), por: por || '' };
  guardar();
}

// Devuelve true si estaba apagado
function encender(jid) {
  recargarSiCambio();
  if (!Object.prototype.hasOwnProperty.call(grupos, jid)) return false;
  delete grupos[jid];
  guardar();
  return true;
}

module.exports = { estaApagado, apagar, encender };

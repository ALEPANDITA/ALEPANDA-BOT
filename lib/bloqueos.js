// lib/bloqueos.js
//
// Lista de usuarios bloqueados del bot (comando .bloquear). Un usuario
// bloqueado no puede usar NADA del bot: ni comandos, ni responder a Simi, etc.
//
// WhatsApp reporta a la misma persona a veces con su numero y a veces con un
// @lid, asi que de cada persona guardamos TODOS los ids que conocemos y al
// revisar un mensaje se compara contra todos (sin llamadas de red, es instantaneo).
//
// Los datos se guardan en bloqueados.json (se comparte con los subbots; se
// vuelve a leer solo si el archivo cambia).

const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', 'bloqueados.json');

let entradas = [];
let mtimeLeido = -1;

// ---------- utilidades ----------

function numeroDe(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function unicos(lista) {
  return [...new Set(lista.filter(Boolean))];
}

function recargarSiCambio() {
  let mtime = 0;
  try { mtime = fs.statSync(ARCHIVO).mtimeMs; } catch (_) { mtime = 0; }
  if (mtime === mtimeLeido) return;
  mtimeLeido = mtime;
  if (!mtime) { entradas = []; return; }
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVO, 'utf-8'));
    entradas = Array.isArray(data.entradas) ? data.entradas : [];
  } catch (err) {
    console.error('[bloqueos] no se pudo leer bloqueados.json:', err.message);
    entradas = [];
  }
}

function guardar() {
  try {
    const tmp = `${ARCHIVO}.tmp${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ entradas }, null, 2));
    fs.renameSync(tmp, ARCHIVO);
    mtimeLeido = fs.statSync(ARCHIVO).mtimeMs;
  } catch (err) {
    console.error('[bloqueos] no se pudo guardar:', err.message);
  }
}

function limpiarVencidas() {
  const ahora = Date.now();
  const antes = entradas.length;
  entradas = entradas.filter((e) => !e.hasta || e.hasta > ahora);
  if (entradas.length !== antes) guardar();
}

// ---------- revisar mensajes ----------

// Ids con los que puede venir el remitente de un mensaje (sin llamadas de red)
function idsDelMensaje(msg) {
  const k = (msg && msg.key) || {};
  const lista = [k.participant, k.participantAlt, k.participantPn, k.remoteJidAlt, msg && msg.participant];
  // En chats privados el remitente es el propio remoteJid (en grupos seria el id del grupo)
  if (k.remoteJid && !String(k.remoteJid).endsWith('@g.us') && !String(k.remoteJid).endsWith('@broadcast')) lista.push(k.remoteJid);
  return unicos(lista.map(numeroDe));
}

// Devuelve la entrada de bloqueo si el remitente del mensaje esta bloqueado, o null
function estaBloqueado(msg) {
  recargarSiCambio();
  if (!entradas.length) return null;
  limpiarVencidas();
  if (!entradas.length) return null;
  const ids = idsDelMensaje(msg);
  if (!ids.length) return null;
  return entradas.find((e) => e.ids.some((id) => ids.includes(id))) || null;
}

// ---------- administrar ----------

// datos: { ids: [jid o numero...], jid, nombre, ms (null = sin limite), por }
function bloquear({ ids, jid, nombre, ms, por }) {
  recargarSiCambio();
  limpiarVencidas();
  const numeros = unicos((ids || []).map(numeroDe));
  if (!numeros.length) return null;

  const hasta = ms ? Date.now() + ms : null;
  let existente = entradas.find((e) => e.ids.some((id) => numeros.includes(id)));
  if (existente) {
    existente.ids = unicos([...existente.ids, ...numeros]);
    existente.hasta = hasta;
    existente.desde = Date.now();
    if (jid) existente.jid = jid;
    if (nombre) existente.nombre = nombre;
    if (por) existente.por = por;
  } else {
    existente = { ids: numeros, jid: jid || `${numeros[0]}@s.whatsapp.net`, nombre: nombre || '', hasta, desde: Date.now(), por: por || '' };
    entradas.push(existente);
  }
  guardar();
  return existente;
}

// Quita el bloqueo de la persona que tenga alguno de esos ids. Devuelve la entrada quitada o null
function desbloquear(ids) {
  recargarSiCambio();
  const numeros = unicos((ids || []).map(numeroDe));
  const i = entradas.findIndex((e) => e.ids.some((id) => numeros.includes(id)));
  if (i === -1) return null;
  const [quitada] = entradas.splice(i, 1);
  guardar();
  return quitada;
}

function desbloquearTodos() {
  recargarSiCambio();
  const n = entradas.length;
  entradas = [];
  guardar();
  return n;
}

function listar() {
  recargarSiCambio();
  limpiarVencidas();
  return entradas.map((e) => ({ ...e }));
}

// ---------- tiempo ----------

const UNIDADES = [
  [/^(s|seg|segs|segundo|segundos)$/, 1000],
  [/^(m|min|mins|minuto|minutos)$/, 60 * 1000],
  [/^(h|hr|hrs|hora|horas)$/, 60 * 60 * 1000],
  [/^(d|dia|dias)$/, 24 * 60 * 60 * 1000],
  [/^(sem|semana|semanas)$/, 7 * 24 * 60 * 60 * 1000]
];

// "1h", "5 minutos", "2d", "1h30m"... -> { ms } | { sinTiempo: true } | { error: true }
function leerDuracion(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (!t) return { sinTiempo: true };

  let total = 0;
  let encontrados = 0;
  const resto = t.replace(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/g, (completo, num, unidad) => {
    const u = UNIDADES.find(([re]) => re.test(unidad));
    if (!u) return completo;
    total += parseFloat(num.replace(',', '.')) * u[1];
    encontrados++;
    return ' ';
  });

  // Si quedo algun numero sin unidad (ej. ".bloquear @user 30") no adivinamos
  if (/\d/.test(resto)) return { error: true };
  if (!encontrados) return { sinTiempo: true };
  if (!(total >= 1000)) return { error: true };
  return { ms: Math.round(total) };
}

function textoDuracion(ms) {
  let s = Math.max(1, Math.round(ms / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const partes = [];
  if (d) partes.push(`${d} dia${d === 1 ? '' : 's'}`);
  if (h) partes.push(`${h} hora${h === 1 ? '' : 's'}`);
  if (m) partes.push(`${m} min`);
  if (!partes.length || (!d && !h && !m)) partes.push(`${s} seg`);
  return partes.slice(0, 2).join(' ');
}

module.exports = {
  estaBloqueado, bloquear, desbloquear, desbloquearTodos, listar,
  leerDuracion, textoDuracion, numeroDe
};

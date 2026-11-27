'use strict';
// lib/mascotas.js — datos del sistema de mascotas (db.mascotas[id] = { id, especie, nombre, tono, duenos:[llaves], xp, creada, ult })
const { claveCanonica } = require('./db');
const { ESPECIES, ORDEN } = require('./mascotart');

const MAX_DUENOS = 10;
const MAX_MASCOTAS = 20;
const MAX_PERFIL = 12;
const VENTA = 0.4;
const TIEMPO_PROPUESTA = 5 * 60 * 1000;
const COOLDOWN = { alimentar: 60 * 60 * 1000, jugar: 15 * 60 * 1000 };
const COSTO_ALIMENTAR = 500;

const num = (id) => String(id || '').split('@')[0].split(':')[0];
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const tabla = (db) => { if (!db.mascotas || typeof db.mascotas !== 'object') db.mascotas = {}; return db.mascotas; };
const esDe = (db, m, llave) => (m.duenos || []).some((d) => claveCanonica(db, d) === llave || num(d) === num(llave));
const misMascotas = (db, llave) => Object.values(tabla(db)).filter((m) => esDe(db, m, llave)).sort((a, b) => (a.creada || 0) - (b.creada || 0) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));

const xpParaNivel = (n) => (n - 1) * (n - 1) * 20;
function nivelDe(xp) { let n = 1; while (xp >= xpParaNivel(n + 1)) n++; return n; }
function progreso(m) {
  const n = nivelDe(m.xp || 0);
  return { nivel: n, xpActual: (m.xp || 0) - xpParaNivel(n), xpSiguiente: xpParaNivel(n + 1) - xpParaNivel(n) };
}

function crear(db, { especie, nombre, duenos }) {
  db.mascotasSeq = (Number(db.mascotasSeq) || 0) + 1;
  const e = ESPECIES[especie];
  const m = {
    id: 'm' + db.mascotasSeq, especie, nombre: nombre || e.nombre, tono: Math.floor(Math.random() * e.tonos.length),
    duenos: duenos.slice(0, MAX_DUENOS), xp: 0, creada: Date.now(), ult: {}
  };
  tabla(db)[m.id] = m;
  return m;
}

function mostradas(db, usuario, llave) {
  const mias = misMascotas(db, llave);
  const ids = Array.isArray(usuario.mascotasPerfil) ? usuario.mascotasPerfil : mias.map((m) => m.id);
  const por = new Map(mias.map((m) => [m.id, m]));
  return ids.map((id) => por.get(id)).filter(Boolean).slice(0, MAX_PERFIL);
}
function fijarPerfil(db, usuario, llave, ids) { usuario.mascotasPerfil = ids.slice(0, MAX_PERFIL); }

function paraPerfil(db, usuario, llave) {
  return mostradas(db, usuario, llave).map((m) => ({ especie: m.especie, tono: m.tono, nombre: m.nombre, nivel: nivelDe(m.xp || 0), compartida: (m.duenos || []).length > 1 }));
}

function buscarEspecie(txt) {
  const t = norm(txt); if (!t) return null;
  if (/^\d+$/.test(t)) return ORDEN[Number(t) - 1] || null;
  return ORDEN.find((k) => k === t || norm(ESPECIES[k].nombre) === t) || ORDEN.find((k) => norm(ESPECIES[k].nombre).startsWith(t)) || null;
}
function buscarMia(db, llave, txt) {
  const mias = misMascotas(db, llave); const t = norm(txt); if (!t) return { mias, m: null };
  if (/^\d+$/.test(t)) return { mias, m: mias[Number(t) - 1] || null };
  return { mias, m: mias.find((x) => norm(x.nombre) === t) || mias.find((x) => norm(x.nombre).startsWith(t)) || null };
}

function limpiarNombre(t) {
  return String(t || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
}

const propuestas = new Map();
function guardarPropuesta(llavePara, p) { propuestas.set(llavePara, { ...p, expira: Date.now() + TIEMPO_PROPUESTA }); }
function propuestaDe(llave) {
  const p = propuestas.get(llave);
  if (p && p.expira < Date.now()) { propuestas.delete(llave); return null; }
  return p || null;
}
const borrarPropuesta = (llave) => propuestas.delete(llave);

module.exports = {
  MAX_DUENOS, MAX_MASCOTAS, MAX_PERFIL, VENTA, COOLDOWN, COSTO_ALIMENTAR, TIEMPO_PROPUESTA,
  tabla, esDe, misMascotas, nivelDe, progreso, crear, mostradas, fijarPerfil, paraPerfil, buscarEspecie, buscarMia, limpiarNombre,
  guardarPropuesta, propuestaDe, borrarPropuesta, num, norm
};

// MASCOTAS-12

// MASCOTAS-DUENOS

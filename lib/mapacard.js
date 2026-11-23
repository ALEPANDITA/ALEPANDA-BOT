'use strict';
// lib/mapacard.js — MAPA DE CIUDAD de tus propiedades.
// Cada propiedad se dibuja como un edificio de verdad (tienda con toldo, torre, fabrica con chimeneas, hotel con palmeras, castillo,
// estadio, barco, avion, cohete...). Crece con el nivel (mas pisos, mas chimeneas, mas luces). Todo se dibuja con formas,
// no depende de que el servidor tenga fuente de emojis. Si tienes muchas propiedades el mapa se parte en paginas (.mapa 2).
const path = require('path');
const fs = require('fs');

const CARPETA_FUENTES = path.join(__dirname, '..', 'assets', 'fonts');
const F = 'MapaSans';
let lib = null;
let hayEmoji = false;

function cargarCanvas() {
  if (lib) return lib;
  lib = require('@napi-rs/canvas');
  for (const archivo of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
    const ruta = path.join(CARPETA_FUENTES, archivo);
    try { if (fs.existsSync(ruta)) lib.GlobalFonts.registerFromPath(ruta, F); } catch (_) { /* usa la del sistema */ }
  }
  try { hayEmoji = lib.GlobalFonts.families.some((f) => /emoji/i.test(f.family)); } catch (_) { hayEmoji = false; }
  return lib;
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu;
const limpiar = (t) => { let s = String(t == null ? '' : t).replace(/\s+/g, ' '); if (!hayEmoji) s = s.replace(EMOJI, ''); return s.trim(); };

function compacto(n) {
  n = Math.round(Number(n) || 0);
  const f = (v, s) => (v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')) + s;
  if (n >= 1e9) return '$' + f(n / 1e9, 'B');
  if (n >= 1e6) return '$' + f(n / 1e6, 'M');
  if (n >= 1e4) return '$' + f(n / 1e3, 'K');
  return '$' + n.toLocaleString('en-US');
}

// ---------- utilidades de dibujo ----------
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
function recortar(ctx, texto, ancho) {
  let t = limpiar(texto);
  if (ctx.measureText(t).width <= ancho) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
const rgb = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hex = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
function sombra(c, f) { // f<1 oscurece, f>1 aclara
  const [r, g, b] = rgb(c);
  const m = (v) => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))));
  return '#' + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function hash(t) { let h = 7; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
const PAREDES = ['#e8d5b7', '#d9e4ef', '#f1c9a5', '#cfe3d4', '#e9c6d6', '#f2e2a8', '#c9cdf0', '#f4b9a0'];
const TECHOS = ['#b4533c', '#4f6d8f', '#7a5a8c', '#3f7d6b', '#a8483f', '#8c6a3d'];

function poligono(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
// Caja con perspectiva: frente + lado derecho + techo. (x,y) = esquina inferior izquierda del frente.
function caja(ctx, x, y, w, h, d, pared, techo) {
  const dx = d * 0.9, dy = d * 0.5;
  poligono(ctx, [[x + w, y], [x + w + dx, y - dy], [x + w + dx, y - h - dy], [x + w, y - h]], sombra(pared, 0.68));
  poligono(ctx, [[x, y - h], [x + w, y - h], [x + w + dx, y - h - dy], [x + dx, y - h - dy]], techo || sombra(pared, 1.25));
  ctx.fillStyle = pared; ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - h + 0.5, w - 1, h - 1);
}
function ventanas(ctx, x, y, w, h, cols, filas, luz, color) {
  const gw = w / cols, gh = h / filas;
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) {
    const encendida = ((r * 7 + c * 3) % 4) !== 0 || luz;
    ctx.fillStyle = encendida ? (color || '#ffe9a0') : '#3a4d63';
    ctx.fillRect(x + c * gw + gw * 0.2, y + r * gh + gh * 0.2, gw * 0.6, gh * 0.58);
  }
}
function puerta(ctx, x, y, w, h, color) {
  ctx.fillStyle = color || '#5b3a24'; rr(ctx, x - w / 2, y - h, w, h, 3); ctx.fill();
  ctx.fillStyle = '#f5d76e'; ctx.beginPath(); ctx.arc(x + w / 2 - 5, y - h / 2, 1.8, 0, 7); ctx.fill();
}
function toldo(ctx, x, y, w, h, c1, c2) {
  const n = Math.max(4, Math.round(w / 16)), a = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? c2 : c1;
    poligono(ctx, [[x + i * a, y], [x + (i + 1) * a, y], [x + (i + 1) * a + 2, y + h], [x + i * a - 2, y + h]], ctx.fillStyle);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 2, y + h, w + 4, 3);
}
function letrero(ctx, cx, y, w, texto, color) {
  ctx.font = `bold 12px ${F}`;
  const t = recortar(ctx, texto, w - 12);
  const tw = Math.max(40, ctx.measureText(t).width + 16);
  ctx.fillStyle = '#2b2118'; ctx.fillRect(cx - 2, y + 12, 4, 10);
  rr(ctx, cx - tw / 2, y - 6, tw, 20, 5); ctx.fillStyle = color || '#1d2b3a'; ctx.fill();
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, cx, y + 8); ctx.textAlign = 'left';
}
function arbol(ctx, x, y, r = 14) {
  ctx.fillStyle = '#5b3a24'; ctx.fillRect(x - 2, y - r * 0.6, 4, r * 0.8 + 2);
  ctx.fillStyle = '#1f7a45'; ctx.beginPath(); ctx.arc(x, y - r, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a9a58'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 1.15, r * 0.6, 0, 7); ctx.fill();
}
function palmera(ctx, x, y, h = 46) {
  ctx.strokeStyle = '#8a6334'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y - h / 2, x + 2, y - h); ctx.stroke();
  ctx.strokeStyle = '#2a9a58'; ctx.lineWidth = 3;
  for (const [a, b] of [[-22, 6], [-16, -8], [0, -14], [16, -8], [22, 6]]) { ctx.beginPath(); ctx.moveTo(x + 2, y - h); ctx.quadraticCurveTo(x + 2 + a / 2, y - h - 12, x + 2 + a, y - h + b); ctx.stroke(); }
}
function humo(ctx, x, y, n) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(230,230,235,${0.55 - i * 0.12})`; ctx.beginPath(); ctx.arc(x + i * 7, y - i * 11, 6 + i * 3, 0, 7); ctx.fill(); }
}
function banderin(ctx, x, y, color) {
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
  poligono(ctx, [[x, y - 30], [x + 18, y - 25], [x, y - 20]], color);
}
function estrellitas(ctx, cx, cy, n, color) {
  ctx.fillStyle = color || '#ffd25a';
  for (let i = 0; i < n; i++) { const a = i * 2.4, r = 18 + (i % 3) * 14; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.8, cy + Math.sin(a) * r * 0.7, 1.8, 0, 7); ctx.fill(); }
}

// ---------- edificios (cx = centro, by = suelo, n = nivel, mx = nivel maximo, o = {acento, pared, techo, nombre}) ----------
const E = {};

E.puesto = (ctx, cx, by, n, mx, o) => {
  const w = 90 + n * 18;
  caja(ctx, cx - w / 2, by, w, 44, 18, o.pared, '#caa66b');
  toldo(ctx, cx - w / 2 - 6, by - 66, w + 12, 20, o.acento, '#ffffff');
  ctx.fillStyle = '#6b4b2a'; ctx.fillRect(cx - w / 2, by - 24, w, 8);
  ctx.fillStyle = '#ffe08a'; ctx.fillRect(cx - w / 2 + 8, by - 38, w - 16, 12);
  letrero(ctx, cx, by - 94, w + 40, o.nombre, sombra(o.acento, 0.55));
  if (n >= 1) { arbol(ctx, cx + w / 2 + 28, by, 11); }
  if (n >= 2) { ctx.fillStyle = o.acento; ctx.beginPath(); ctx.arc(cx - w / 2 - 22, by - 30, 24, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#6b4b2a'; ctx.fillRect(cx - w / 2 - 23, by - 30, 2, 30); }
};

E.tienda = (ctx, cx, by, n, mx, o) => {
  const w = 190, pisos = 1 + Math.min(n, 2), h = 54 + pisos * 30;
  const x = cx - w / 2;
  caja(ctx, x, by, w, h, 26, o.pared, o.techo);
  for (let p = 1; p < pisos; p++) ventanas(ctx, x + 10, by - h + 6 + (p - 1) * 30, w - 20, 26, 5, 1, n >= 1);
  ctx.fillStyle = '#9fd4f0'; ctx.fillRect(x + 12, by - 46, w * 0.5, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; poligono(ctx, [[x + 12, by - 46], [x + 40, by - 46], [x + 22, by - 10], [x + 12, by - 10]], ctx.fillStyle);
  puerta(ctx, x + w * 0.78, by, 26, 44);
  toldo(ctx, x + 2, by - 58, w - 4, 16, o.acento, '#ffffff');
  letrero(ctx, cx, by - h - 12, w, o.nombre, sombra(o.acento, 0.5));
  if (n >= 1) arbol(ctx, x - 14, by, 10);
  if (n >= 2) { ctx.fillStyle = o.acento; ctx.fillRect(x + w + 4, by - 50, 4, 50); banderin(ctx, x + w + 6, by - 50, o.acento); }
};

E.torre = (ctx, cx, by, n, mx, o) => {
  const w = 96 + n * 6, h = 120 + n * 38;
  const x = cx - w / 2;
  caja(ctx, x, by, w, h, 30, sombra(o.pared, 0.9), sombra(o.acento, 0.8));
  ctx.fillStyle = 'rgba(160,210,255,0.25)'; ctx.fillRect(x, by - h, w, h);
  ventanas(ctx, x + 6, by - h + 8, w - 12, h - 36, 5, Math.round((h - 36) / 20), n >= 1, '#bfe6ff');
  puerta(ctx, cx, by, 24, 24, '#33465c');
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 12, by - h - 10); ctx.lineTo(cx + 12, by - h - 34 - n * 6); ctx.stroke();
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(cx + 12, by - h - 36 - n * 6, 3, 0, 7); ctx.fill();
  if (n >= 1) { caja(ctx, x - 52, by, 48, 44 + n * 6, 16, sombra(o.pared, 0.8), sombra(o.acento, 0.8)); ventanas(ctx, x - 48, by - 36 - n * 6, 40, 26 + n * 6, 3, 2, true, '#bfe6ff'); }
  letrero(ctx, cx, by - h - 46 - n * 6, 200, o.nombre, sombra(o.acento, 0.5));
};

E.fabrica = (ctx, cx, by, n, mx, o) => {
  const w = 210, h = 70;
  const x = cx - w / 2;
  const ch = Math.min(3, 1 + n);
  for (let i = 0; i < ch; i++) { const px = x + 16 + i * 44; ctx.fillStyle = '#8a4a3a'; ctx.fillRect(px, by - h - 52, 18, 54); ctx.fillStyle = '#d65a3a'; ctx.fillRect(px, by - h - 52, 18, 6); humo(ctx, px + 9, by - h - 58, 3); }
  caja(ctx, x, by, w, h, 24, '#aab2bd', '#7f8896');
  for (let i = 0; i < 4; i++) poligono(ctx, [[x + i * 52, by - h], [x + i * 52 + 52, by - h], [x + i * 52 + 52, by - h - 20]], sombra(o.acento, 0.8));
  ventanas(ctx, x + 12, by - h + 12, w - 24, 22, 6, 1, n >= 1, '#ffd98a');
  ctx.fillStyle = '#55606d'; ctx.fillRect(x + w / 2 - 28, by - 36, 56, 36); ctx.strokeStyle = '#3a424d'; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + w / 2 - 28, by - 6 * i); ctx.lineTo(x + w / 2 + 28, by - 6 * i); ctx.stroke(); }
  if (n >= 2) { ctx.fillStyle = '#c0c6cf'; ctx.fillRect(x + w + 20, by - 50, 26, 50); ctx.beginPath(); ctx.arc(x + w + 33, by - 50, 13, Math.PI, 0); ctx.fill(); }
  letrero(ctx, cx, by - h - 70, 220, o.nombre, sombra(o.acento, 0.5));
};

E.granja = (ctx, cx, by, n, mx, o) => {
  const x = cx - 80;
  caja(ctx, x, by, 120, 64, 22, '#b3402f', '#8a2f22');
  poligono(ctx, [[x - 6, by - 64], [x + 60, by - 104], [x + 126, by - 64]], '#7a2a1f');
  ctx.fillStyle = '#f4e8d0'; ctx.fillRect(x + 42, by - 44, 36, 44); ctx.strokeStyle = '#7a2a1f'; ctx.lineWidth = 2; ctx.strokeRect(x + 42, by - 44, 36, 44);
  ctx.beginPath(); ctx.moveTo(x + 42, by - 44); ctx.lineTo(x + 78, by); ctx.moveTo(x + 78, by - 44); ctx.lineTo(x + 42, by); ctx.stroke();
  ctx.fillStyle = '#c9ced6'; ctx.fillRect(x + 140, by - 80, 28, 80); ctx.beginPath(); ctx.arc(x + 154, by - 80, 14, Math.PI, 0); ctx.fill();
  for (let i = 0; i < 2 + n; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + 20 + i * 26, by + 12, 10, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(x + 14 + i * 26, by + 8, 5, 4); }
  letrero(ctx, cx, by - 118, 220, o.nombre, sombra(o.acento, 0.5));
};

E.hotel = (ctx, cx, by, n, mx, o) => {
  const w = 200, pisos = 3 + n * 2, h = pisos * 24;
  const x = cx - w / 2;
  caja(ctx, x, by, w, h, 28, o.pared, sombra(o.acento, 0.9));
  for (let p = 0; p < pisos - 1; p++) {
    ventanas(ctx, x + 10, by - h + 8 + p * 24, w - 20, 20, 6, 1, false, '#bfe6ff');
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 6, by - h + 28 + p * 24, w - 12, 3);
  }
  puerta(ctx, cx, by, 30, 34, '#33465c');
  toldo(ctx, cx - 30, by - 44, 60, 12, o.acento, '#fff');
  palmera(ctx, x - 18, by, 48); if (n >= 1) palmera(ctx, x + w + 36, by, 56);
  ctx.fillStyle = '#4fc3f7'; rr(ctx, x + w + 4, by - 4, 40, 18, 6); ctx.fill();
  letrero(ctx, cx, by - h - 18, 220, o.nombre, sombra(o.acento, 0.5));
  if (n >= 2) estrellitas(ctx, cx, by - h - 40, 8);
};

E.estadio = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#8f98a6'; ctx.beginPath(); ctx.ellipse(cx, by - 38, 128, 56, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6f7886'; ctx.beginPath(); ctx.ellipse(cx, by - 46, 128, 56, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c7ccd6'; ctx.beginPath(); ctx.ellipse(cx, by - 54, 110, 44, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2e9e4f'; ctx.beginPath(); ctx.ellipse(cx, by - 54, 80, 28, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(cx - 52, by - 70, 104, 32); ctx.beginPath(); ctx.moveTo(cx, by - 70); ctx.lineTo(cx, by - 38); ctx.stroke();
  for (const sx of [-1, 1]) { ctx.fillStyle = '#ddd'; ctx.fillRect(cx + sx * 124 - 2, by - 120, 4, 80); ctx.fillStyle = '#fff6b0'; ctx.fillRect(cx + sx * 124 - 12, by - 128, 24, 10); }
  letrero(ctx, cx, by - 134, 220, o.nombre, sombra(o.acento, 0.5));
};

E.parque = (ctx, cx, by, n, mx, o) => {
  const r = 58 + n * 6;
  ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 34, by); ctx.lineTo(cx, by - r - 10); ctx.lineTo(cx + 34, by); ctx.stroke();
  ctx.strokeStyle = o.acento; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, by - r - 10, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, by - r - 10); ctx.lineTo(cx + Math.cos(a) * r, by - r - 10 + Math.sin(a) * r); ctx.stroke(); ctx.fillStyle = i % 2 ? '#ffd25a' : '#ff6fa8'; ctx.fillRect(cx + Math.cos(a) * r - 6, by - r - 10 + Math.sin(a) * r - 5, 12, 10); }
  caja(ctx, cx + 70, by, 70, 36, 16, '#f2e2a8', o.acento); toldo(ctx, cx + 66, by - 36, 78, 14, '#ff6fa8', '#fff');
  caja(ctx, cx - 140, by, 60, 30, 14, '#cfe3d4', '#ffd25a');
  letrero(ctx, cx, by - r * 2 - 30, 220, o.nombre, sombra(o.acento, 0.5));
};

E.marquesina = (ctx, cx, by, n, mx, o) => { // cine, teatro, casino, discoteca, arcade
  const w = 200, h = 84 + n * 14, x = cx - w / 2;
  caja(ctx, x, by, w, h, 26, sombra(o.pared, 0.75), '#3a2b4f');
  ctx.fillStyle = '#17111f'; ctx.fillRect(x + 10, by - h + 10, w - 20, 34);
  const bombillos = Math.floor((w - 20) / 12);
  for (let i = 0; i < bombillos; i++) { ctx.fillStyle = i % 2 ? '#ffd25a' : '#ff6fa8'; ctx.beginPath(); ctx.arc(x + 16 + i * 12, by - h + 14, 2.6, 0, 7); ctx.arc(x + 16 + i * 12, by - h + 40, 2.6, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffe9a0'; ctx.font = `bold 15px ${F}`; ctx.textAlign = 'center'; ctx.fillText(recortar(ctx, o.nombre, w - 36).toUpperCase(), cx, by - h + 32); ctx.textAlign = 'left';
  ventanas(ctx, x + 12, by - h + 52, w - 24, h - 90, 6, 1, true, '#ff9ad0');
  ctx.fillStyle = '#7a1f3d'; rr(ctx, cx - 22, by - 40, 44, 40, 4); ctx.fill(); puerta(ctx, cx, by, 24, 34, '#2a1520');
  for (const sx of [-1, 1]) { ctx.fillStyle = hex('#ff6fa8', 0.35); poligono(ctx, [[cx + sx * 40, by], [cx + sx * 70, by], [cx + sx * 150, by + 40], [cx + sx * 20, by + 40]], ctx.fillStyle); }
  if (n >= 1) { ctx.fillStyle = hex('#fff6b0', 0.18); poligono(ctx, [[cx - 8, by - h - 10], [cx + 8, by - h - 10], [cx + 60, by - h - 90], [cx - 60, by - h - 90]], ctx.fillStyle); }
};

E.banco = (ctx, cx, by, n, mx, o) => {
  const w = 190, h = 70 + n * 14, x = cx - w / 2;
  caja(ctx, x, by, w, h, 24, '#e8e2d2', '#cfc7b2');
  poligono(ctx, [[x - 8, by - h], [cx, by - h - 38], [x + w + 8, by - h]], '#d9d1bb', 'rgba(0,0,0,0.25)');
  ctx.fillStyle = '#f5d76e'; ctx.font = `bold 20px ${F}`; ctx.textAlign = 'center'; ctx.fillText('$', cx, by - h - 8); ctx.textAlign = 'left';
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fbf7ea'; ctx.fillRect(x + 14 + i * 28, by - h + 6, 12, h - 18); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 22 + i * 28, by - h + 6, 4, h - 18); }
  ctx.fillStyle = '#c9bfa5'; ctx.fillRect(x - 6, by - 12, w + 12, 12); ctx.fillRect(x - 12, by - 5, w + 24, 5);
  puerta(ctx, cx, by - 12, 26, 38, '#6b4b2a');
  letrero(ctx, cx, by - h - 58, 220, o.nombre, sombra(o.acento, 0.5));
  if (n >= 1) { ctx.fillStyle = '#ddd'; ctx.fillRect(x + w + 24, by - 80, 3, 80); poligono(ctx, [[x + w + 27, by - 80], [x + w + 50, by - 74], [x + w + 27, by - 66]], o.acento); }
};

E.deposito = (ctx, cx, by, n, mx, o, id) => { // transporte
  const w = 190, h = 60, x = cx - w / 2;
  caja(ctx, x, by, w, h, 22, '#c9ced6', '#98a0ad');
  ctx.fillStyle = '#4a5260'; ctx.fillRect(x + 12, by - 44, 46, 44); ctx.fillRect(x + 66, by - 44, 46, 44);
  ctx.strokeStyle = '#2d333d'; for (const bx of [x + 12, x + 66]) for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(bx, by - i * 9); ctx.lineTo(bx + 46, by - i * 9); ctx.stroke(); }
  ctx.fillStyle = o.acento; ctx.fillRect(x, by - h, w, 10);
  ctx.fillStyle = '#fff'; ctx.font = `bold 11px ${F}`; ctx.fillText(recortar(ctx, o.nombre, w - 16).toUpperCase(), x + 8, by - h + 8);
  const cols = { taxis: '#ffd23a', bicitaxis: '#ff8a3c', camiones: '#d44', autobuses: '#2f7de1', paqueteria: '#8a5a2b', gasolinera: '#e84' };
  const vx = x + w - 62, vy = by + 24;
  const cuerpo = cols[id] || o.acento;
  const largo = id === 'autobuses' ? 120 : id === 'camiones' ? 100 : 70;
  ctx.fillStyle = cuerpo; rr(ctx, vx - largo + 62, vy - 30, largo, 28, 6); ctx.fill();
  ctx.fillStyle = '#bfe6ff'; for (let i = 0; i < Math.floor(largo / 24); i++) ctx.fillRect(vx - largo + 70 + i * 22, vy - 26, 16, 10);
  ctx.fillStyle = '#222'; for (const wx of [vx - largo + 80, vx + 32]) { ctx.beginPath(); ctx.arc(wx, vy - 2, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(wx, vy - 2, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; }
  if (n >= 1) { ctx.fillStyle = hex(o.acento, 0.9); ctx.fillRect(x - 26, by - 30, 20, 30); }
  if (n >= 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w + 14, by - 46, 3, 46); ctx.fillStyle = o.acento; ctx.fillRect(x + w + 17, by - 46, 22, 14); }
};

E.tren = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#6b5a45'; ctx.fillRect(cx - 150, by + 6, 300, 6); ctx.fillStyle = '#9a8870'; for (let i = 0; i < 24; i++) ctx.fillRect(cx - 148 + i * 12.5, by + 3, 5, 12);
  const n_v = 2 + n;
  for (let i = 0; i < n_v; i++) { const vx = cx - 140 + i * 84; ctx.fillStyle = i === 0 ? o.acento : '#e8ecf2'; rr(ctx, vx, by - 56, i === 0 ? 100 : 80, 54, 10); ctx.fill(); ctx.fillStyle = '#7fb8e6'; for (let k = 0; k < 3; k++) ctx.fillRect(vx + 10 + k * 22, by - 46, 16, 14); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(vx + 20, by, 7, 0, 7); ctx.arc(vx + 60, by, 7, 0, 7); ctx.fill(); }
  letrero(ctx, cx, by - 90, 220, o.nombre, sombra(o.acento, 0.5));
};

E.barco = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#1b5f9e'; rr(ctx, cx - 140, by - 14, 280, 42, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - 130 + i * 48, by + 14); ctx.quadraticCurveTo(cx - 118 + i * 48, by + 8, cx - 106 + i * 48, by + 14); ctx.stroke(); }
  poligono(ctx, [[cx - 120, by - 14], [cx + 120, by - 14], [cx + 100, by + 10], [cx - 100, by + 10]], '#2d3b4f');
  ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 120, by - 8, 240, 4);
  const pisos = 2 + n;
  for (let p = 0; p < pisos; p++) { const pw = 190 - p * 26; ctx.fillStyle = p % 2 ? '#e8ecf2' : '#fff'; ctx.fillRect(cx - pw / 2, by - 14 - (p + 1) * 18, pw, 18); ventanas(ctx, cx - pw / 2 + 6, by - 12 - (p + 1) * 18, pw - 12, 12, Math.floor(pw / 18), 1, true, '#7fb8e6'); }
  const ty = by - 14 - pisos * 18;
  ctx.fillStyle = o.acento; ctx.fillRect(cx - 14, ty - 26, 28, 26); ctx.fillStyle = '#222'; ctx.fillRect(cx - 14, ty - 26, 28, 5);
  letrero(ctx, cx, ty - 46, 220, o.nombre, sombra(o.acento, 0.5));
};

E.avion = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#4b5463'; ctx.fillRect(cx - 160, by + 2, 320, 22); ctx.strokeStyle = '#fff'; ctx.setLineDash([14, 12]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 150, by + 13); ctx.lineTo(cx + 150, by + 13); ctx.stroke(); ctx.setLineDash([]);
  caja(ctx, cx - 150, by, 90, 40, 18, '#dfe6ee', '#a9b4c2'); ventanas(ctx, cx - 144, by - 34, 78, 14, 6, 1, true, '#7fb8e6');
  ctx.fillStyle = '#c9d2dd'; ctx.fillRect(cx - 114, by - 78, 14, 38); ctx.fillStyle = '#7fb8e6'; ctx.fillRect(cx - 124, by - 92, 34, 16);
  const px = cx + 20, py = by - 12, s = 1 + n * 0.12;
  ctx.fillStyle = '#f3f6fa'; ctx.beginPath(); ctx.ellipse(px + 40, py, 78 * s, 15 * s, 0, 0, 7); ctx.fill();
  poligono(ctx, [[px + 20, py - 4], [px + 62, py - 4], [px + 18, py - 52 * s]], o.acento);
  poligono(ctx, [[px + 20, py + 4], [px + 62, py + 4], [px + 18, py + 40 * s]], sombra(o.acento, 0.8));
  poligono(ctx, [[px - 30, py - 4], [px - 8, py - 4], [px - 34, py - 30 * s]], o.acento);
  ctx.fillStyle = '#7fb8e6'; for (let i = 0; i < 6; i++) ctx.fillRect(px + 18 + i * 12, py - 6, 7, 5);
  letrero(ctx, cx, by - 112, 220, o.nombre, sombra(o.acento, 0.5));
};

E.cohete = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#59606d'; ctx.fillRect(cx - 80, by - 4, 160, 14); ctx.fillStyle = '#8b94a3'; ctx.fillRect(cx + 34, by - 130, 10, 126);
  const h = 120 + n * 14;
  ctx.fillStyle = '#f4f6fa'; rr(ctx, cx - 20, by - h, 40, h - 4, 18); ctx.fill();
  poligono(ctx, [[cx - 20, by - h + 26], [cx, by - h - 28], [cx + 20, by - h + 26]], o.acento);
  ctx.fillStyle = '#7fb8e6'; ctx.beginPath(); ctx.arc(cx, by - h + 52, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#8b94a3'; ctx.lineWidth = 3; ctx.stroke();
  poligono(ctx, [[cx - 20, by - 26], [cx - 40, by - 2], [cx - 20, by - 6]], o.acento); poligono(ctx, [[cx + 20, by - 26], [cx + 40, by - 2], [cx + 20, by - 6]], o.acento);
  ctx.fillStyle = '#ffb84d'; poligono(ctx, [[cx - 10, by - 4], [cx + 10, by - 4], [cx, by + 22]], '#ffb84d');
  estrellitas(ctx, cx, by - h - 10, 12 + n * 2, '#fff6b0');
  letrero(ctx, cx, by - h - 48, 220, o.nombre, sombra(o.acento, 0.5));
};

E.castillo = (ctx, cx, by, n, mx, o) => {
  const w = 190, x = cx - w / 2, h = 80 + n * 10;
  caja(ctx, x + 30, by, w - 60, h, 20, '#c9c3b4', '#a9a392');
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#c9c3b4'; ctx.fillRect(x + 32 + i * 22, by - h - 8, 12, 10); }
  for (const tx of [x - 6, x + w - 40]) {
    caja(ctx, tx, by, 46, h + 36, 12, '#d7d1c2', '#b4ae9d');
    poligono(ctx, [[tx - 6, by - h - 36], [tx + 23, by - h - 84], [tx + 52, by - h - 36]], o.acento, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = '#3a4d63'; rr(ctx, tx + 17, by - h - 18, 12, 22, 6); ctx.fill();
    banderin(ctx, tx + 23, by - h - 84, '#ff4d6d');
  }
  ctx.fillStyle = '#3a2a1c'; rr(ctx, cx - 18, by - 52, 36, 52, 18); ctx.fill();
  ventanas(ctx, x + 60, by - h + 14, w - 120, 24, 3, 1, true);
  if (n >= 2) estrellitas(ctx, cx, by - h - 70, 10);
  letrero(ctx, cx, by - h - 104, 220, o.nombre, sombra(o.acento, 0.5));
};

E.isla = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#2a8fd6'; ctx.beginPath(); ctx.ellipse(cx, by + 6, 150, 34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2d9a0'; ctx.beginPath(); ctx.ellipse(cx, by - 4, 112, 24, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4fbf7a'; ctx.beginPath(); ctx.ellipse(cx, by - 8, 70, 14, 0, 0, 7); ctx.fill();
  palmera(ctx, cx - 56, by - 6, 62); palmera(ctx, cx + 62, by - 4, 54); if (n >= 1) palmera(ctx, cx + 8, by - 12, 70);
  caja(ctx, cx - 28, by - 8, 56, 30, 14, '#f4e4c4', '#c0623b'); poligono(ctx, [[cx - 34, by - 38], [cx + 2, by - 66], [cx + 40, by - 38]], '#c0623b');
  ctx.fillStyle = '#8a6334'; ctx.fillRect(cx + 70, by + 8, 60, 6);
  letrero(ctx, cx, by - 96, 220, o.nombre, sombra(o.acento, 0.5));
};

E.mina = (ctx, cx, by, n, mx, o) => {
  poligono(ctx, [[cx - 140, by], [cx - 30, by - 110 - n * 10], [cx + 20, by - 70], [cx + 60, by - 100 - n * 8], [cx + 150, by]], '#7b6f63', 'rgba(0,0,0,0.3)');
  poligono(ctx, [[cx - 30, by - 110 - n * 10], [cx - 4, by - 80], [cx - 50, by - 60]], '#a49a8f');
  ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.moveTo(cx - 34, by); ctx.lineTo(cx - 34, by - 46); ctx.quadraticCurveTo(cx, by - 70, cx + 34, by - 46); ctx.lineTo(cx + 34, by); ctx.fill();
  ctx.strokeStyle = '#8a6334'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - 36, by); ctx.lineTo(cx - 36, by - 46); ctx.moveTo(cx + 36, by); ctx.lineTo(cx + 36, by - 46); ctx.stroke();
  ctx.fillStyle = '#6b6f78'; ctx.fillRect(cx + 70, by - 18, 36, 16); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx + 78, by, 5, 0, 7); ctx.arc(cx + 100, by, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(cx + 80, by - 22, 5, 0, 7); ctx.arc(cx + 92, by - 24, 4, 0, 7); ctx.fill();
  if (n >= 1) { ctx.fillStyle = '#7fe0ff'; poligono(ctx, [[cx - 100, by - 6], [cx - 92, by - 22], [cx - 84, by - 6]], '#7fe0ff'); }
  letrero(ctx, cx, by - 140 - n * 8, 220, o.nombre, sombra(o.acento, 0.5));
};

E.refineria = (ctx, cx, by, n, mx, o) => {
  for (let i = 0; i < 3; i++) { const tx = cx - 120 + i * 80; ctx.fillStyle = '#c9ced6'; ctx.fillRect(tx, by - 50, 56, 50); ctx.beginPath(); ctx.ellipse(tx + 28, by - 50, 28, 9, 0, 0, 7); ctx.fillStyle = '#e2e6ec'; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(tx + 40, by - 50, 16, 50); }
  ctx.fillStyle = '#8b94a3'; ctx.fillRect(cx + 100, by - 130, 10, 130);
  ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.moveTo(cx + 105, by - 160); ctx.quadraticCurveTo(cx + 120, by - 140, cx + 105, by - 128); ctx.quadraticCurveTo(cx + 92, by - 140, cx + 105, by - 160); ctx.fill();
  ctx.strokeStyle = '#8b94a3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 92, by - 50); ctx.lineTo(cx - 92, by - 76); ctx.lineTo(cx + 105, by - 76); ctx.stroke();
  letrero(ctx, cx, by - 178, 220, o.nombre, sombra(o.acento, 0.5));
};

E.panda = (ctx, cx, by, n, mx, o) => {
  for (let i = 0; i < 7; i++) { const bx = cx - 130 + i * 40 + (i % 2) * 8, bh = 90 + (i * 23) % 50; ctx.fillStyle = '#4fae5c'; ctx.fillRect(bx, by - bh, 8, bh); ctx.fillStyle = '#2f7d3f'; for (let k = 1; k < 5; k++) ctx.fillRect(bx - 1, by - bh + k * 22, 10, 3); ctx.fillStyle = '#7fd68a'; ctx.beginPath(); ctx.ellipse(bx + 14, by - bh + 10, 12, 4, 0.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#f7f7f7'; ctx.beginPath(); ctx.ellipse(cx, by - 26, 44, 38, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * 32, by - 56, 11, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + sx * 17, by - 28, 11, 14, sx * 0.4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 17, by - 30, 3, 0, 7); ctx.arc(cx - 17, by - 30, 3, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(cx, by - 16, 6, 4, 0, 0, 7); ctx.fill();
  if (n >= 1) { caja(ctx, cx + 70, by, 70, 34, 14, '#e7d6b0', '#4fae5c'); }
  letrero(ctx, cx, by - 138, 220, o.nombre, sombra(o.acento, 0.5));
};

E.satelite = (ctx, cx, by, n, mx, o) => {
  ctx.fillStyle = '#c9ced6'; ctx.fillRect(cx - 12, by - 40, 24, 40);
  ctx.save(); ctx.translate(cx, by - 60); ctx.rotate(-0.5);
  ctx.fillStyle = '#e8ecf2'; ctx.beginPath(); ctx.ellipse(0, 0, 58 + n * 6, 22 + n * 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#8b94a3'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = o.acento; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46); ctx.stroke(); ctx.fillStyle = o.acento; ctx.beginPath(); ctx.arc(0, -48, 4, 0, 7); ctx.fill();
  ctx.restore();
  caja(ctx, cx + 60, by, 80, 40, 16, '#dfe6ee', '#4f6d8f'); ventanas(ctx, cx + 66, by - 34, 68, 24, 4, 1, true, '#bfe6ff');
  estrellitas(ctx, cx - 60, by - 120, 6, '#fff6b0');
  letrero(ctx, cx, by - 140, 220, o.nombre, sombra(o.acento, 0.5));
};

E.megaciudad = (ctx, cx, by, n, mx, o) => { // capital: skyline
  const hs = [70, 130, 96, 170, 110, 150, 84];
  hs.forEach((h, i) => {
    const w = 38, x = cx - 140 + i * 40;
    caja(ctx, x, by, w, h + n * 6, 12, sombra(PAREDES[(i + 2) % PAREDES.length], 0.7), sombra(o.acento, 0.9));
    ctx.fillStyle = 'rgba(160,210,255,0.25)'; ctx.fillRect(x, by - h - n * 6, w, h + n * 6);
    ventanas(ctx, x + 4, by - h - n * 6 + 6, w - 8, h + n * 6 - 12, 3, Math.round((h + n * 6) / 16), true, '#ffe9a0');
  });
  ctx.fillStyle = hex(o.acento, 0.2); ctx.beginPath(); ctx.ellipse(cx, by - 80, 170, 90, 0, 0, 7); ctx.fill();
  estrellitas(ctx, cx, by - 190, 10, '#fff6b0');
  letrero(ctx, cx, by - 206, 240, o.nombre, sombra(o.acento, 0.5));
};

E.mall = (ctx, cx, by, n, mx, o) => {
  const w = 250, h = 70 + n * 8, x = cx - w / 2;
  caja(ctx, x, by, w, h, 28, o.pared, sombra(o.acento, 0.9));
  ctx.fillStyle = 'rgba(160,210,255,0.4)'; ctx.fillRect(x + 8, by - h + 20, w - 16, h - 24);
  ventanas(ctx, x + 12, by - h + 8, w - 24, 14, 12, 1, true);
  toldo(ctx, x + 4, by - 46, w - 8, 14, o.acento, '#fff');
  puerta(ctx, cx, by, 40, 36, '#33465c');
  ctx.fillStyle = o.acento; rr(ctx, cx - 54, by - h - 34, 108, 30, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold 15px ${F}`; ctx.textAlign = 'center'; ctx.fillText('MALL', cx, by - h - 13); ctx.textAlign = 'left';
  letrero(ctx, cx, by - h - 54, 220, o.nombre, sombra(o.acento, 0.5));
};

const ESTILO_POR_ID = {
  tacos: 'puesto', nieves: 'puesto', elotes: 'puesto', hotdogs: 'puesto', foodtruck: 'puesto', camping: 'puesto', bicitaxis: 'puesto', cibercafe: 'tienda',
  estadio: 'estadio', parquediver: 'parque', acuatico: 'parque', cine: 'marquesina', teatro: 'marquesina', discoteca: 'marquesina', casino: 'marquesina', arcade: 'marquesina', karaoke: 'marquesina', boliche: 'marquesina',
  hotel: 'hotel', hotelplaya: 'hotel', hostal: 'hotel', cabanas: 'hotel', hotelmirador: 'hotel',
  granja: 'granja', invernadero: 'granja', refineria: 'refineria', pozopetrolero: 'refineria', mina: 'mina', minadiamantes: 'mina',
  crucero: 'barco', puerto: 'barco', puertomundial: 'barco', pesquera: 'barco', aerolinea: 'avion', aeropuerto: 'avion',
  tren: 'tren', taxis: 'deposito', camiones: 'deposito', autobuses: 'deposito', paqueteria: 'deposito', gasolinera: 'deposito',
  espacial: 'cohete', cohetes: 'cohete', satelites: 'satelite', castillo: 'castillo', isla: 'isla', santuariopanda: 'panda',
  bancolocal: 'banco', bolsa: 'banco', holding: 'banco', cambio: 'banco', seguros: 'banco', empeno: 'banco', notaria: 'banco', despacho: 'banco',
  megamall: 'mall', plaza: 'mall', supermercado: 'mall', rascacielos: 'megaciudad', ciudad: 'megaciudad', conglomerado: 'megaciudad',
  clubfutbol: 'estadio', cinedeluxe: 'marquesina', casinodorado: 'marquesina', fondalegendaria: 'tienda', jugueteria: 'tienda', tiendabarrio: 'tienda'
};
const ESTILO_POR_CAT = { comida: 'tienda', comercio: 'tienda', servicios: 'tienda', diversion: 'marquesina', turismo: 'hotel', industria: 'fabrica', tecnologia: 'torre', transporte: 'deposito', finanzas: 'banco', capital: 'megaciudad', exclusivas: 'castillo' };
const estiloDe = (it) => ESTILO_POR_ID[it.id] || ESTILO_POR_CAT[it.cat] || 'tienda';

// ---------- escena ----------
function terrenoLibre(ctx, x, y, w, h, texto) {
  rr(ctx, x + 10, y + 10, w - 20, h - 20, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
  ctx.setLineDash([8, 7]); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#d7c49a'; ctx.fillRect(x + w / 2 - 2, y + h - 100, 4, 40); rr(ctx, x + w / 2 - 38, y + h - 122, 76, 26, 5); ctx.fillStyle = '#b4533c'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${F}`; ctx.textAlign = 'center'; ctx.fillText(texto || 'SE VENDE', x + w / 2, y + h - 104); ctx.textAlign = 'left';
}

function calle(ctx, y, W, carros) {
  ctx.fillStyle = '#2a313c'; ctx.fillRect(0, y, W, 34);
  ctx.fillStyle = '#3a4351'; ctx.fillRect(0, y, W, 3); ctx.fillRect(0, y + 31, W, 3);
  ctx.strokeStyle = '#f2d65a'; ctx.lineWidth = 2; ctx.setLineDash([22, 16]); ctx.beginPath(); ctx.moveTo(0, y + 17); ctx.lineTo(W, y + 17); ctx.stroke(); ctx.setLineDash([]);
  carros.forEach(([x, col, dir]) => {
    const cy = y + (dir > 0 ? 21 : 4);
    ctx.fillStyle = col; rr(ctx, x, cy, 46, 11, 4); ctx.fill();
    ctx.fillStyle = sombra(col, 1.4); rr(ctx, x + 12, cy - 4, 20, 7, 3); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 10, cy + 11, 3.2, 0, 7); ctx.arc(x + 36, cy + 11, 3.2, 0, 7); ctx.fill();
  });
}

const POR_PAGINA = 12;

function crearMapa(d) {
  const { createCanvas } = cargarCanvas();
  const W = 1100, PAD = 22, COLS = 3, LW = Math.floor((W - PAD * 2) / COLS), LH = 280, CALLE = 34, BANDA = 44;
  const pagina = Math.max(1, Math.floor(d.pagina) || 1);
  const ordenCat = new Map(d.categorias.map((c, i) => [c.id, i]));
  const todos = [...d.items].sort((a, b) => (ordenCat.get(a.cat) - ordenCat.get(b.cat)) || (b.hora - a.hora));
  const paginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const items = todos.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const catDe = (id) => d.categorias.find((c) => c.id === id) || d.categorias[0];

  // Filas: cada vez que cambia el barrio se abre una banda con su nombre y empieza fila nueva
  const filas = [];
  let actual = null;
  for (const it of items) {
    if (!actual || actual.cat !== it.cat || actual.lotes.length >= COLS) {
      const nueva = !actual || actual.cat !== it.cat;
      actual = { cat: it.cat, banda: nueva, lotes: [] };
      filas.push(actual);
    }
    actual.lotes.push(it);
  }
  if (pag === paginas && filas.length) { // terrenos libres para rellenar la ultima fila
    const ult = filas[filas.length - 1];
    while (ult.lotes.length < COLS) ult.lotes.push(null);
  }
  const HEAD = pag === 1 ? 238 : 120;
  let alto = HEAD;
  for (const f of filas) alto += (f.banda ? BANDA : 0) + LH + CALLE;
  alto += 78;

  const ESC = Math.min(1.5, 4200 / alto);
  const lienzo = createCanvas(Math.round(W * ESC), Math.round(alto * ESC));
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESC, ESC);
  ctx.textBaseline = 'alphabetic';

  // cielo + horizonte
  const cielo = ctx.createLinearGradient(0, 0, 0, HEAD + 40);
  cielo.addColorStop(0, '#0a1530'); cielo.addColorStop(1, '#2a3f6b');
  ctx.fillStyle = '#26402f'; ctx.fillRect(0, 0, W, alto);
  ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, HEAD + 40);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.25 + (i % 4) * 0.15; ctx.fillRect((i * 193) % W, (i * 71) % (HEAD - 10), 2, 2); } ctx.globalAlpha = 1;
  ctx.fillStyle = '#101d38';
  for (let i = 0, x = 0; x < W; i++) { const bw = 34 + (i * 17) % 40, bh = 30 + (i * 53) % 70; ctx.fillRect(x, HEAD + 40 - bh, bw, bh); x += bw + 4; }
  ctx.fillStyle = '#1f6f45'; ctx.fillRect(0, HEAD + 40, W, 6);

  // panel de datos
  rr(ctx, PAD, 18, W - PAD * 2, HEAD - 34, 20);
  ctx.fillStyle = 'rgba(8,16,26,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,90,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffd25a'; ctx.font = `bold ${pag === 1 ? 34 : 28}px ${F}`; ctx.textAlign = 'left';
  ctx.fillText('MAPA DE LA CIUDAD', PAD + 24, pag === 1 ? 68 : 62);
  ctx.fillStyle = '#b9e0ff'; ctx.font = `19px ${F}`;
  const pagTxt = paginas > 1 ? `  ·  página ${pag}/${paginas}` : '';
  ctx.fillText(recortar(ctx, `Imperio de ${d.nombre}` + (d.compartido ? `  ·  compartido con ${d.nombrePareja || 'tu pareja'}` : '') + pagTxt, W - PAD * 2 - 48), PAD + 24, pag === 1 ? 98 : 92);
  if (pag === 1) {
    const cajas = [['PROPIEDADES', `${d.cantidad} / ${d.total}`, '#b48cff'], ['POR HORA', compacto(d.porHora), '#4de3a0'], ['EN 24 HORAS', compacto(d.en24), '#ffd25a'], ['POR COBRAR YA', compacto(d.porCobrar), '#ff9a4d']];
    const bw = Math.floor((W - PAD * 2 - 48 - 3 * 14) / 4);
    cajas.forEach(([t, v, col], i) => {
      const x = PAD + 24 + i * (bw + 14), y = 120;
      rr(ctx, x, y, bw, 70, 14); ctx.fillStyle = hex(col, 0.16); ctx.fill();
      ctx.strokeStyle = hex(col, 0.75); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = col; ctx.font = `bold 13px ${F}`; ctx.fillText(t, x + 14, y + 23);
      ctx.fillStyle = '#fff'; ctx.font = `bold 29px ${F}`; ctx.fillText(recortar(ctx, v, bw - 24), x + 14, y + 57);
    });
  }

  // barrios
  let y = HEAD + 20;
  let ci = 0;
  for (const f of filas) {
    const cat = catDe(f.cat);
    if (f.banda) {
      rr(ctx, PAD, y, W - PAD * 2, BANDA - 8, 10);
      ctx.fillStyle = hex(cat.color, 0.9); ctx.fill();
      ctx.fillStyle = '#10151d'; ctx.font = `bold 19px ${F}`;
      ctx.fillText(`BARRIO ${limpiar(cat.nombre).toUpperCase()}`, PAD + 18, y + 24);
      const total = items.filter((x) => x.cat === f.cat).reduce((t, x) => t + x.hora, 0);
      ctx.textAlign = 'right'; ctx.font = `bold 15px ${F}`; ctx.fillText(`${compacto(total)}/h en esta página`, W - PAD - 18, y + 23); ctx.textAlign = 'left';
      y += BANDA;
    }
    ctx.fillStyle = sombra('#2b5a3e', 0.9); ctx.fillRect(0, y - 6, W, LH + 6);
    ctx.fillStyle = hex(cat.color, 0.10); ctx.fillRect(0, y - 6, W, LH + 6);
    f.lotes.forEach((it, k) => {
      const lx = PAD + k * LW, by = y + LH - 74, cx = lx + LW / 2;
      rr(ctx, lx + 8, y + 4, LW - 16, LH - 10, 14);
      ctx.fillStyle = 'rgba(205,210,200,0.16)'; ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(lx + 14, by - 2, LW - 28, 18);
      if (!it) { terrenoLibre(ctx, lx, y, LW, LH); return; }
      const h = hash(it.id || it.nombre);
      const o = { acento: cat.color, pared: PAREDES[h % PAREDES.length], techo: TECHOS[(h >> 3) % TECHOS.length], nombre: it.nombre };
      ctx.save();
      ctx.beginPath(); ctx.rect(lx + 8, y - 30, LW - 16, LH + 20); ctx.clip();
      try { E[estiloDe(it)](ctx, cx, by, it.nivel, it.maxNivel, o, it.id); } catch (e) { E.tienda(ctx, cx, by, it.nivel, it.maxNivel, o); }
      ctx.restore();
      if (it.bono) { ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 3; rr(ctx, lx + 8, y + 4, LW - 16, LH - 10, 14); ctx.stroke(); }
      else if (it.deMiPareja) { ctx.setLineDash([7, 6]); ctx.strokeStyle = '#ffc2dc'; ctx.lineWidth = 2; rr(ctx, lx + 8, y + 4, LW - 16, LH - 10, 14); ctx.stroke(); ctx.setLineDash([]); }
      const px = lx + 22, pw = LW - 44, py = y + LH - 52;
      rr(ctx, px, py, pw, 42, 10); ctx.fillStyle = 'rgba(8,14,22,0.88)'; ctx.fill(); ctx.strokeStyle = hex(cat.color, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#7dffc0'; ctx.font = `bold 17px ${F}`; ctx.fillText(`${compacto(it.hora)}/h`, px + 12, py + 26);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `12px ${F}`; ctx.fillText(`24h: ${compacto(it.hora * 24)}`, px + 12, py + 38);
      for (let p = 0; p < it.maxNivel; p++) { const xx = px + pw - 18 - (it.maxNivel - 1 - p) * 15; rr(ctx, xx - 6, py + 8, 12, 12, 3); ctx.fillStyle = p < it.nivel ? '#ffd25a' : 'rgba(255,255,255,0.2)'; ctx.fill(); }
      ctx.textAlign = 'right';
      if (it.bono) { rr(ctx, px + pw - 92, py + 23, 82, 16, 8); ctx.fillStyle = '#ff6fa8'; ctx.fill(); ctx.fillStyle = '#2a0f22'; ctx.font = `bold 11px ${F}`; ctx.textAlign = 'center'; ctx.fillText('PAREJA x1.5', px + pw - 51, py + 35); }
      else if (it.deMiPareja) { ctx.fillStyle = '#ffc2dc'; ctx.font = `italic 11px ${F}`; ctx.fillText('de tu pareja', px + pw - 10, py + 36); }
      else if (it.exclusiva) { ctx.fillStyle = '#ffd25a'; ctx.font = `bold 11px ${F}`; ctx.fillText('EXCLUSIVA', px + pw - 10, py + 36); }
      ctx.textAlign = 'left';
      if (ci++ % 2 === 0) arbol(ctx, lx + 24, by + 14, 11);
    });
    calle(ctx, y + LH, W, [[(hash(f.cat) % 300) + 40, '#e0533f', 1], [(hash(f.cat) % 200) + 520, '#3fa0e0', -1], [(hash(f.cat + 'x') % 200) + 800, '#e0c23f', 1]]);
    y += LH + CALLE;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, alto - 70, W, 70);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `13px ${F}`;
  ctx.fillText('Más cuadritos amarillos = edificio mejorado (crece y se ilumina)  ·  borde rosa = bono de pareja  ·  punteado = de tu pareja', PAD, alto - 44);
  ctx.fillStyle = '#ffd25a'; ctx.font = `bold 15px ${F}`;
  ctx.fillText('Lo que se junta llega hasta 24 horas. Cóbralo con .recolectar' + (d.bonos ? `   ·   ${d.bonos} con bono de pareja` : '') + (paginas > 1 ? `   ·   .mapa ${pag < paginas ? pag + 1 : 1} para ${pag < paginas ? 'seguir' : 'volver'}` : ''), PAD, alto - 20);
  return { buffer: lienzo.toBuffer('image/png'), pagina: pag, paginas };
}

module.exports = { crearMapa, compacto, POR_PAGINA };

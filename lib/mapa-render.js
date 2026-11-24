'use strict';
// Dibuja en el servidor las 4 partes del mapa ilustrado (.mapa 1 al .mapa 4) como imágenes JPEG.
// El mundo (terreno, ríos, caminos, árboles) se arma una sola vez y se guarda en memoria.
const fs = require('fs');
const path = require('path');
const M = require('./mapa-mundo');
const { estadosMapa } = require('./mapa-estados');

let motor = null;
function cargar() {
  if (motor) return motor;
  const lib = require('@napi-rs/canvas');
  for (const f of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
    const ruta = path.join(__dirname, '..', 'assets', 'fonts', f);
    try { if (fs.existsSync(ruta)) lib.GlobalFonts.registerFromPath(ruta, 'MapaSans'); } catch (_) { /* usa la del sistema */ }
  }
  const base = estadosMapa({}, {});
  const mundo = M.crearMundo(base, { crearLienzo: (w, h) => lib.createCanvas(w, h) }, { S: 4 });
  motor = { lib, mundo };
  return motor;
}

// Cuántas propiedades de la persona caen en cada parte (para el texto de abajo de la imagen)
function resumenPartes(estados) {
  const { mundo } = cargar();
  const por = Object.fromEntries(estados.map((e) => [e.id, e]));
  return M.PARTES.map((p) => {
    const dentro = mundo.lotes.filter((l) => l.x >= p[0] && l.x < p[0] + p[2] && l.y >= p[1] && l.y < p[1] + p[3]);
    return { total: dentro.length, tiene: dentro.filter((l) => por[l.id] && !por[l.id].gris).length };
  });
}

// Rectángulo redondeado (si esta versión del canvas no trae roundRect, se hace a mano)
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// parte: 1..4. Devuelve un Buffer JPEG.
// stats: [['Por hora', '$1,200'], ...] se dibuja arriba, igual que en el panel (propiedades, por hora, en 24 h, por cobrar).
function dibujarParte(estados, parte, { escala = 0.9, calidad = 84, titulo = '', stats = [] } = {}) {
  const { lib, mundo } = cargar();
  const p = M.PARTES[parte - 1];
  const w = Math.round(p[2] * escala), h = Math.round(p[3] * escala);
  const cv = lib.createCanvas(w, h), ctx = cv.getContext('2d');
  M.pintar(ctx, mundo, estados, { escala, region: p });

  // Cinta de arriba: nombre y parte + mini-mapa + los números de la persona
  const F = "MapaSans, 'Segoe UI', Arial, sans-serif", X = 14, Y = 14, ALTO = 66;
  const medir = (t, fuente) => { ctx.font = fuente; return ctx.measureText(t).width; };
  let nombre = String(titulo || 'MAPA'); if (nombre.length > 26) nombre = nombre.slice(0, 25) + '…';
  const sub = `Parte ${parte} de 4 · ${M.NOMBRE_CUADRANTE[parte - 1]}`;
  const wIzq = Math.max(medir(nombre, `bold 20px ${F}`), medir(sub, `15px ${F}`));
  const pildoras = stats.map(([et, val]) => ({ et, val: String(val), w: Math.max(medir(et, `12px ${F}`), medir(String(val), `bold 19px ${F}`)) + 26 }));
  let total = 16 + wIzq + 14 + 52 + 14 + pildoras.reduce((a, q) => a + q.w + 8, 0) + 4;
  while (pildoras.length > 1 && X + total > w - 14) { total -= pildoras.pop().w + 8; } // si no caben, se quitan las últimas
  ctx.fillStyle = 'rgba(20,28,32,0.84)'; rr(ctx, X, Y, total, ALTO, 14); ctx.fill();
  let x = X + 16;
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 20px ${F}`; ctx.fillText(nombre, x, Y + 28);
  ctx.fillStyle = '#9fe8c4'; ctx.font = `15px ${F}`; ctx.fillText(sub, x, Y + 52);
  x += wIzq + 14;
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i === parte - 1 ? '#3ddc97' : '#56646b'; ctx.fillRect(x + (i % 2) * 28, Y + 12 + Math.floor(i / 2) * 22, 24, 18); }
  x += 52 + 14;
  for (const q of pildoras) {
    ctx.fillStyle = '#12302b'; rr(ctx, x, Y + 8, q.w, ALTO - 16, 10); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1f5a4a'; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fe8c4'; ctx.font = `12px ${F}`; ctx.fillText(q.et, x + q.w / 2, Y + 25);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 19px ${F}`; ctx.fillText(q.val, x + q.w / 2, Y + 47);
    ctx.textAlign = 'left';
    x += q.w + 8;
  }
  return cv.toBuffer('image/jpeg', calidad);
}

module.exports = { dibujarParte, resumenPartes, cargar };

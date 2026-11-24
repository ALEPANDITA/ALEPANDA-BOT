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

// parte: 1..4. Devuelve un Buffer JPEG.
function dibujarParte(estados, parte, { escala = 0.9, calidad = 84, titulo = '' } = {}) {
  const { lib, mundo } = cargar();
  const p = M.PARTES[parte - 1];
  const w = Math.round(p[2] * escala), h = Math.round(p[3] * escala);
  const cv = lib.createCanvas(w, h), ctx = cv.getContext('2d');
  M.pintar(ctx, mundo, estados, { escala, region: p });
  // cinta con el nombre y un mini-mapa que dice qué parte es
  const F = "MapaSans, 'Segoe UI', Arial, sans-serif", ancho = 300;
  ctx.fillStyle = 'rgba(20,28,32,0.78)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(14, 14, ancho + 84, 66, 14) : ctx.rect(14, 14, ancho + 84, 66); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 20px ${F}`; ctx.fillText(titulo || 'MAPA', 30, 42);
  ctx.fillStyle = '#9fe8c4'; ctx.font = `15px ${F}`; ctx.fillText(`Parte ${parte} de 4 · ${M.NOMBRE_CUADRANTE[parte - 1]}`, 30, 66);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i === parte - 1 ? '#3ddc97' : '#56646b'; ctx.fillRect(ancho + 30 + (i % 2) * 28, 26 + Math.floor(i / 2) * 22, 24, 18); }
  return cv.toBuffer('image/jpeg', calidad);
}

module.exports = { dibujarParte, resumenPartes, cargar };

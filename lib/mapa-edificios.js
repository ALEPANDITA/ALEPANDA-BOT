// Dibujos (con canvas, sin imágenes ni emojis) de las propiedades del .mapa.
// Cada edificio se dibuja en un espacio local: el origen (0,0) es el centro del suelo, "arriba" es y negativo y todo
// cabe en unos 150 de ancho por 140 de alto. mapacard.js lo coloca y lo escala.

(function (root) {
'use strict';
const PI = Math.PI;
const FUENTE = "MapaSans, 'Segoe UI', Roboto, Arial, sans-serif";

// ---------------- utilidades ----------------
function hash(txt) { let h = 2166136261; for (const ch of String(txt)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function rgb(c) { if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const m = c.match(/\d+/g); return [+m[0], +m[1], +m[2]]; }
function tono(c, f) { // f < 1 oscurece, f > 1 aclara
  const [r, g, b] = rgb(c);
  const dest = f < 1 ? 0 : 255, t = Math.min(1, f < 1 ? 1 - f : f - 1);
  const k = (v) => Math.round(v + (dest - v) * t);
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}
const alfa = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };

const rect = (ctx, x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
const circ = (ctx, x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fillStyle = fill; ctx.fill(); };
const elip = (ctx, x, y, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, PI * 2); ctx.fillStyle = fill; ctx.fill(); };
const poli = (ctx, pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
const linea = (ctx, x1, y1, x2, y2, col, w = 1) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
function rrect(ctx, x, y, w, h, r, fill) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

// Caja en perspectiva: (x,y) es la esquina inferior izquierda del frente; d es la profundidad.
function caja(ctx, x, y, w, h, d, col) {
  const dx = d * 0.8, dy = -d * 0.45;
  poli(ctx, [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y - h + dy], [x + w, y - h]], tono(col, 0.7));
  poli(ctx, [[x, y - h], [x + dx, y - h + dy], [x + w + dx, y - h + dy], [x + w, y - h]], tono(col, 1.22));
  rect(ctx, x, y - h, w, h, col);
}
function ventana(ctx, x, y, w, h, col = '#a9d8f5') {
  rect(ctx, x, y, w, h, col);
  poli(ctx, [[x, y + h], [x + w * 0.45, y], [x + w * 0.75, y], [x + w * 0.3, y + h]], 'rgba(255,255,255,0.35)');
  ctx.strokeStyle = 'rgba(30,40,60,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function ventanas(ctx, x, y, w, h, filas, cols, col, hueco = 4) {
  const vw = (w - hueco * (cols + 1)) / cols, vh = (h - hueco * (filas + 1)) / filas;
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) ventana(ctx, x + hueco + c * (vw + hueco), y + hueco + f * (vh + hueco), vw, vh, col);
}
function puerta(ctx, x, y, w, h, col = '#6b4a2f') {
  rect(ctx, x, y, w, h, col); rect(ctx, x + w * 0.5 - 0.5, y, 1, h, 'rgba(0,0,0,0.35)');
  circ(ctx, x + w * 0.75, y + h * 0.55, 1.4, '#f5d77a');
}
function toldo(ctx, x, y, w, h, c1, c2 = '#ffffff', n = 6) {
  const a = w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(x + i * a, y); ctx.lineTo(x + (i + 1) * a, y); ctx.lineTo(x + (i + 1) * a, y + h);
    ctx.arc(x + (i + 0.5) * a, y + h, a / 2, 0, PI); ctx.closePath();
    ctx.fillStyle = i % 2 ? c2 : c1; ctx.fill();
  }
  rect(ctx, x, y - 2, w, 3, tono(c1, 0.8));
}
function simbolo(ctx, tipo, x, y, r, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, r * 0.22);
  switch (tipo) {
    case 'cruz': rect(ctx, x - r * 0.32, y - r, r * 0.64, r * 2, col); rect(ctx, x - r, y - r * 0.32, r * 2, r * 0.64, col); break;
    case 'corazon':
      ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
      ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.35);
      ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9); ctx.fill(); break;
    case 'estrella':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      ctx.closePath(); ctx.fill(); break;
    case 'moneda':
      circ(ctx, x, y, r, col); circ(ctx, x, y, r * 0.68, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = col; ctx.font = `bold ${Math.round(r * 1.3)}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, y + 1); ctx.textBaseline = 'alphabetic'; break;
    case 'pata':
      elip(ctx, x, y + r * 0.35, r * 0.62, r * 0.5, col);
      [[-0.8, -0.2], [-0.3, -0.7], [0.3, -0.7], [0.8, -0.2]].forEach(([a, b]) => circ(ctx, x + a * r, y + b * r, r * 0.25, col)); break;
    case 'hoja': ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.8); ctx.quadraticCurveTo(x - r * 0.6, y - r, x + r, y - r * 0.8); ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.7, x - r, y + r * 0.8); ctx.fill(); break;
    case 'flor':
      for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5 - PI / 2; circ(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.42, col); }
      circ(ctx, x, y, r * 0.3, 'rgba(255,230,120,1)'); break;
    case 'taza':
      rect(ctx, x - r * 0.7, y - r * 0.2, r * 1.2, r * 1.0, col); ctx.beginPath(); ctx.arc(x + r * 0.55, y + r * 0.25, r * 0.38, -PI / 2, PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.4); ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.8, x - r * 0.3, y - r * 1.1); ctx.stroke(); break;
    case 'pizza': poli(ctx, [[x - r, y - r * 0.6], [x + r, y - r * 0.6], [x, y + r]], col); circ(ctx, x - r * 0.25, y - r * 0.15, r * 0.17, 'rgba(0,0,0,0.3)'); circ(ctx, x + r * 0.25, y - r * 0.15, r * 0.17, 'rgba(0,0,0,0.3)'); break;
    case 'rayo': poli(ctx, [[x + r * 0.2, y - r], [x - r * 0.7, y + r * 0.1], [x - r * 0.05, y + r * 0.1], [x - r * 0.2, y + r], [x + r * 0.7, y - r * 0.15], [x + r * 0.05, y - r * 0.15]], col); break;
    case 'gota': ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + r * 1.1, y + r * 0.3, x, y + r); ctx.quadraticCurveTo(x - r * 1.1, y + r * 0.3, x, y - r); ctx.fill(); break;
    case 'llave': ctx.beginPath(); ctx.arc(x - r * 0.45, y, r * 0.45, 0, PI * 2); ctx.stroke(); linea(ctx, x - r * 0.05, y, x + r, y, col, ctx.lineWidth); linea(ctx, x + r * 0.7, y, x + r * 0.7, y + r * 0.5, col, ctx.lineWidth); break;
    case 'diamante': poli(ctx, [[x - r, y - r * 0.2], [x - r * 0.5, y - r * 0.8], [x + r * 0.5, y - r * 0.8], [x + r, y - r * 0.2], [x, y + r]], col); break;
    case 'libro': rect(ctx, x - r, y - r * 0.7, r * 0.95, r * 1.4, col); rect(ctx, x + r * 0.05, y - r * 0.7, r * 0.95, r * 1.4, tono(col, 0.8)); break;
    case 'nota': circ(ctx, x - r * 0.35, y + r * 0.6, r * 0.38, col); rect(ctx, x - r * 0.05, y - r, r * 0.2, r * 1.65, col); rect(ctx, x - r * 0.05, y - r, r * 0.8, r * 0.3, col); break;
    case 'pelota': circ(ctx, x, y, r, col); circ(ctx, x - r * 0.3, y - r * 0.25, r * 0.16, 'rgba(0,0,0,0.4)'); circ(ctx, x + r * 0.1, y - r * 0.4, r * 0.16, 'rgba(0,0,0,0.4)'); circ(ctx, x - r * 0.05, y - r * 0.05, r * 0.16, 'rgba(0,0,0,0.4)'); break;
    case 'dado':
      rrect(ctx, x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, r * 0.3, col);
      [[-0.45, -0.45], [0.45, -0.45], [0, 0], [-0.45, 0.45], [0.45, 0.45]].forEach(([a, b]) => circ(ctx, x + a * r, y + b * r, r * 0.14, 'rgba(20,20,30,0.85)')); break;
    case 'engranaje':
      for (let i = 0; i < 8; i++) { const a = i * PI / 4; poli(ctx, [[x + Math.cos(a - 0.2) * r, y + Math.sin(a - 0.2) * r], [x + Math.cos(a + 0.2) * r, y + Math.sin(a + 0.2) * r], [x + Math.cos(a + 0.2) * r * 0.6, y + Math.sin(a + 0.2) * r * 0.6], [x + Math.cos(a - 0.2) * r * 0.6, y + Math.sin(a - 0.2) * r * 0.6]], col); }
      circ(ctx, x, y, r * 0.7, col); circ(ctx, x, y, r * 0.3, 'rgba(0,0,0,0.35)'); break;
    case 'corona': poli(ctx, [[x - r, y + r * 0.7], [x - r, y - r * 0.5], [x - r * 0.45, y + r * 0.05], [x, y - r * 0.8], [x + r * 0.45, y + r * 0.05], [x + r, y - r * 0.5], [x + r, y + r * 0.7]], col); break;
    default: simbolo2(ctx, tipo, x, y, r, col);
  }
  ctx.textAlign = 'left';
}
function cartel(ctx, x, y, w, h, fondo, sim, colSim = '#ffffff') {
  rrect(ctx, x, y, w, h, 3, tono(fondo, 0.7)); rrect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 2.5, fondo);
  if (sim) simbolo(ctx, sim, x + w / 2, y + h / 2, Math.min(h * 0.34, w * 0.3), colSim);
  else rect(ctx, x + w * 0.2, y + h / 2 - 1, w * 0.6, 2, 'rgba(255,255,255,0.7)');
}
function arbol(ctx, x, y, s = 1, col = '#3f9e55') {
  rect(ctx, x - 2 * s, y - 12 * s, 4 * s, 12 * s, '#7a5230');
  circ(ctx, x, y - 22 * s, 11 * s, tono(col, 0.85)); circ(ctx, x - 5 * s, y - 17 * s, 8 * s, col); circ(ctx, x + 5 * s, y - 18 * s, 8 * s, tono(col, 1.15));
}
function palmera(ctx, x, y, s = 1) {
  ctx.strokeStyle = '#9c6b3a'; ctx.lineWidth = 3.5 * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5 * s, y - 20 * s, x + 2 * s, y - 36 * s); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -PI / 2 + (i - 2.5) * 0.55, lx = x + 2 * s + Math.cos(a) * 22 * s, ly = y - 36 * s + Math.sin(a) * 14 * s + 4 * s;
    ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 36 * s); ctx.quadraticCurveTo((x + lx) / 2, ly - 8 * s, lx, ly + 5 * s); ctx.strokeStyle = '#2f9a52'; ctx.lineWidth = 3.5 * s; ctx.stroke();
  }
}
function humo(ctx, x, y, r) { [[0, 0, 5], [4, -9, 6.5], [-2, -20, 8], [5, -33, 9.5]].forEach(([a, b, c], i) => circ(ctx, x + a, y + b, c, `rgba(235,235,240,${0.8 - i * 0.14})`)); void r; }
function coche(ctx, x, y, col, s = 1) {
  rrect(ctx, x - 12 * s, y - 8 * s, 24 * s, 8 * s, 3 * s, col);
  rrect(ctx, x - 7 * s, y - 14 * s, 14 * s, 7 * s, 3 * s, tono(col, 1.1));
  rect(ctx, x - 5.5 * s, y - 13 * s, 5 * s, 5 * s, '#bfe6ff'); rect(ctx, x + 0.5 * s, y - 13 * s, 5 * s, 5 * s, '#bfe6ff');
  circ(ctx, x - 7 * s, y, 2.6 * s, '#222'); circ(ctx, x + 7 * s, y, 2.6 * s, '#222');
}
function sombra(ctx, rx = 70, ry = 9, dx = 6) { elip(ctx, dx, 2, rx, ry, 'rgba(0,0,0,0.25)'); }
function mesaSombrilla(ctx, x, y, col) {
  rect(ctx, x - 1, y - 20, 2, 20, '#8a6a4a'); poli(ctx, [[x - 11, y - 18], [x + 11, y - 18], [x, y - 27]], col); elip(ctx, x, y, 7, 3, '#d9c9a8');
}

// ---------------- edificios ----------------
function tienda(ctx, o) {
  const { c, n } = o, pisos = o.pisos || 1, w = (o.chico ? 88 : 104) + n * 5, hf = 52, alto = hf + (pisos - 1) * 34, x = -w / 2 - 6;
  sombra(ctx, w / 2 + 14);
  caja(ctx, x, 0, w, alto, 26, c.pared);
  for (let p = 1; p < pisos; p++) ventanas(ctx, x + 4, -(hf + p * 34) + 8, w - 8, 26, 1, Math.max(3, Math.round(w / 26)), o.vidrio || '#a9d8f5');
  rect(ctx, x, -alto, w, 5, tono(c.techo, 0.95));
  cartel(ctx, x + 6, -hf + 2, w - 12, 14, c.acento, o.sim, '#fff');
  toldo(ctx, x + 4, -hf + 17, w - 8, 10, o.toldo || c.acento, '#fff', Math.max(5, Math.round(w / 15)));
  ventana(ctx, x + 9, -25, w - 46, 22, o.vidrio || '#a9d8f5');
  puerta(ctx, x + w - 30, -27, 21, 27);
  if (o.cruz) simbolo(ctx, 'cruz', x + w - 8, -hf - 12, 6, '#e23b4a');
  if (o.macetas !== false) { rect(ctx, x + 2, -5, 8, 5, '#b4673a'); circ(ctx, x + 6, -9, 4.2, '#55b46a'); }
  if (o.acon !== false) rect(ctx, x + w - 22, -alto - 7, 14, 7, '#c9d1d9');
}
function puesto(ctx, o) {
  const { c, n } = o, cant = 1 + (n >= 1 ? 1 : 0) + (n >= 3 ? 1 : 0), col = o.col || c.acento;
  sombra(ctx, 30 + cant * 28, 8);
  for (let i = 0; i < cant; i++) {
    const x = (i - (cant - 1) / 2) * 56 - 22;
    rect(ctx, x + 2, -62, 3, 40, '#8a6a4a'); rect(ctx, x + 41, -62, 3, 40, '#8a6a4a');
    caja(ctx, x, 0, 44, 26, 14, '#c98b4e');
    rect(ctx, x, -26, 44, 4, tono('#c98b4e', 1.2));
    toldo(ctx, x - 6, -66, 56, 13, col, '#fff', 6);
    circ(ctx, x + 12, -29, 4.5, o.comida || '#f5c04a'); circ(ctx, x + 22, -29, 4.5, tono(o.comida || '#f5c04a', 0.85)); circ(ctx, x + 32, -29, 4.5, o.comida || '#f5c04a');
    circ(ctx, x + 6, 0, 4.5, '#333'); circ(ctx, x + 38, 0, 4.5, '#333');
  }
}
function restaurante(ctx, o) {
  const { c, n } = o, pisos = (o.pisos || 1), w = 112 + n * 4, x = -w / 2 - 6, alto = 56 + (pisos - 1) * 30;
  sombra(ctx, w / 2 + 18);
  caja(ctx, x, 0, w, alto, 26, c.pared);
  for (let p = 1; p < pisos; p++) ventanas(ctx, x + 4, -(56 + p * 30) + 6, w - 8, 24, 1, 4, '#ffe9a8');
  rect(ctx, x, -alto, w, 5, tono(c.techo, 0.95));
  rect(ctx, x + w - 26, -alto - 16, 9, 18, '#a3523a'); humo(ctx, x + w - 21.5, -alto - 20);
  cartel(ctx, x + 6, -54, w - 12, 15, c.acento, o.sim, '#fff');
  toldo(ctx, x + 4, -38, w - 8, 10, c.acento, '#fff', 8);
  ventana(ctx, x + 9, -26, w - 46, 20, '#ffe9a8'); puerta(ctx, x + w - 30, -27, 21, 27, '#7a4a2a');
  mesaSombrilla(ctx, x + 18, 10, c.acento); mesaSombrilla(ctx, x + 56, 12, tono(c.acento, 1.25));
  if (o.dorado) rect(ctx, x, -alto, w, 3, '#f5c04a');
}
function oficina(ctx, o) {
  const { c, n } = o, pisos = 4 + n + (o.pisos || 0), w = 82, x = -w / 2 - 5, alto = pisos * 17 + 8, vidrio = o.vidrio || '#8fc4e8';
  sombra(ctx, w / 2 + 16);
  caja(ctx, x, 0, w, alto, 24, '#9fb3c6');
  ventanas(ctx, x + 2, -alto + 2, w - 4, alto - 22, pisos - 1, 4, vidrio, 3);
  rect(ctx, x, -alto, w, 4, tono('#9fb3c6', 0.8));
  rect(ctx, x + 10, -alto - 6, 18, 6, '#c9d1d9'); rect(ctx, x + 40, -alto - 9, 14, 9, '#c9d1d9');
  cartel(ctx, x + 14, -20, w - 28, 12, c.acento, o.sim); puerta(ctx, x + w / 2 - 8, -9, 16, 9, '#3b4a5c');
  if (o.server) for (let i = 0; i < 3; i++) { rect(ctx, x + w + 12 + 0, -10 - i * 8, 12, 6, '#445'); circ(ctx, x + w + 15, -7 - i * 8, 1.2, '#5f5'); }
  if (o.domo) { ctx.beginPath(); ctx.arc(x + w / 2 + 6, -alto - 2, 14, PI, 0); ctx.fillStyle = alfa('#7dd3fc', 0.8); ctx.fill(); simbolo(ctx, 'estrella', x + w / 2 + 6, -alto - 8, 5, '#fff'); }
}
function torre(ctx, o) {
  const { c, n } = o;
  const una = (x, pisos, w, col) => {
    const alto = pisos * 15 + 6;
    caja(ctx, x - w / 2, 0, w, alto, 16, col);
    ventanas(ctx, x - w / 2 + 2, -alto + 2, w - 4, alto - 4, pisos - 1, Math.max(2, Math.round(w / 15)), '#bfe3ff', 2);
    rect(ctx, x - w / 2, -alto, w, 3, tono(col, 0.75));
    linea(ctx, x, -alto, x, -alto - 14, '#555', 1.5); circ(ctx, x, -alto - 15, 2, '#ff4444');
  };
  const cl = o.cluster || 1;
  sombra(ctx, 38 + cl * 12);
  if (cl === 1) { una(-2, 7 + n, 54, '#7f93b2'); }
  else if (cl === 3) { una(-40, 5 + n, 36, '#8aa0c0'); una(36, 6 + n, 36, '#6f86ab'); una(0, 8 + n, 44, '#9fb3c9'); }
  else { una(-58, 4, 28, '#8aa0c0'); una(-28, 6, 30, '#a0b5cf'); una(4, 8 + n, 36, '#7f93b2'); una(38, 6, 30, '#95abc7'); una(64, 4, 26, '#8aa0c0'); }
  if (o.antena) { linea(ctx, 0, -110, 0, -128, '#666', 2); circ(ctx, 0, -130, 3, '#ff4444'); ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -126, 10, -0.9, 0.9); ctx.stroke(); }
  if (c.acento) cartel(ctx, -16, -12, 32, 10, c.acento, null);
}
function hospital(ctx, o) {
  const w = 120, x = -w / 2 - 6, alto = 70;
  sombra(ctx, w / 2 + 16);
  caja(ctx, x, 0, w, alto, 28, '#f1f5f9');
  ventanas(ctx, x + 4, -alto + 4, w - 8, 40, 2, 7, '#a9d8f5', 3);
  rect(ctx, x, -alto, w, 4, '#cbd5e1');
  rrect(ctx, x + w / 2 - 17, -30, 34, 26, 3, '#e23b4a'); simbolo(ctx, 'cruz', x + w / 2, -17, 9, '#fff');
  puerta(ctx, x + w / 2 - 8, -9, 16, 9, '#7aa'); elip(ctx, x + 24, -alto - 4, 13, 5, '#94a3b8'); simbolo(ctx, 'cruz', x + 24, -alto - 4, 3.5, '#fff');
  rect(ctx, x + w + 8, -9, 17, 6, '#fff'); rect(ctx, x + w + 8, -11, 17, 2, '#e23b4a'); circ(ctx, x + w + 12, -2, 2.5, '#222'); circ(ctx, x + w + 21, -2, 2.5, '#222');
}
function fabrica(ctx, o) {
  const { c, n } = o, w = 122 + n * 4, x = -w / 2 - 6, alto = 48;
  sombra(ctx, w / 2 + 14);
  const pared = o.ladrillo ? '#b4573a' : '#aab4bf';
  caja(ctx, x, 0, w, alto, 28, pared);
  if (o.ladrillo) for (let y = 4; y < alto; y += 6) rect(ctx, x, -y, w, 1, 'rgba(0,0,0,0.15)');
  for (let i = 0; i < 3; i++) { const sx = x + 6 + i * 38; poli(ctx, [[sx, -alto], [sx, -alto - 16], [sx + 32, -alto]], c.techo); rect(ctx, sx, -alto - 16, 2, 16, '#ddd'); }
  rect(ctx, x + w - 22, -alto - 38, 11, 40, '#8a5a44'); rect(ctx, x + w - 22, -alto - 38, 11, 4, '#333'); humo(ctx, x + w - 16.5, -alto - 42);
  rect(ctx, x + 22, -alto - 28, 9, 30, '#8a5a44'); rect(ctx, x + 22, -alto - 28, 9, 4, '#333'); humo(ctx, x + 26.5, -alto - 32);
  rect(ctx, x + 14, -30, 38, 30, '#667788'); for (let k = 1; k < 5; k++) rect(ctx, x + 14, -30 + k * 6, 38, 1, 'rgba(0,0,0,0.3)');
  ventanas(ctx, x + 62, -36, 50, 20, 1, 4, '#cfe6f7', 3);
  cartel(ctx, x + 14, -alto + 6, 44, 10, c.acento, null);
  if (o.tanque) { rect(ctx, x + w + 6, -34, 16, 34, '#cbd5e1'); elip(ctx, x + w + 14, -34, 8, 3, '#e5e7eb'); }
  if (o.horno) { circ(ctx, x + 50, -alto - 6, 3, '#ff7a1a'); poli(ctx, [[x + 44, -alto - 6], [x + 50, -alto - 18], [x + 56, -alto - 6]], alfa('#ff9a2a', 0.85)); }
}
function tanques(ctx, o) {
  sombra(ctx, 74, 10);
  if (o.pozo) {
    rect(ctx, -70, -6, 140, 6, '#6b5b4b'); poli(ctx, [[-22, 0], [0, -86], [22, 0]], 'none'); ctx.strokeStyle = '#444'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(0, -88); ctx.lineTo(24, 0); ctx.moveTo(-14, -30); ctx.lineTo(14, -30); ctx.moveTo(-8, -55); ctx.lineTo(8, -55); ctx.stroke();
    circ(ctx, 0, -90, 4, '#f5c04a');
    rect(ctx, 38, -22, 6, 22, '#555'); poli(ctx, [[30, -26], [62, -34], [66, -28], [34, -20]], '#e8553a'); circ(ctx, 62, -28, 6, '#555');
    elip(ctx, -50, -10, 16, 6, '#1f1f26'); elip(ctx, -50, -12, 12, 3, '#3a3a46');
    return;
  }
  [[-48, 62, 26], [-10, 76, 30], [32, 56, 24]].forEach(([x, h, w], i) => {
    rect(ctx, x - w / 2, -h, w, h, i === 1 ? '#d9dee5' : '#c3cbd5'); rect(ctx, x + w / 2 - 6, -h, 6, h, 'rgba(0,0,0,0.12)');
    elip(ctx, x, -h, w / 2, 5, '#eef1f5'); rect(ctx, x - w / 2, -h * 0.55, w, 3, '#e23b4a');
  });
  linea(ctx, -48, -48, -10, -52, '#666', 3); linea(ctx, -10, -40, 32, -36, '#666', 3);
  rect(ctx, 56, -100, 4, 100, '#555'); poli(ctx, [[58, -104], [51, -118], [58, -112], [65, -118]], '#ff8a1a'); poli(ctx, [[58, -104], [54, -113], [58, -109], [62, -113]], '#ffd24a');
}
function mina(ctx, o) {
  sombra(ctx, 74, 9);
  poli(ctx, [[-76, 0], [-30, -62], [8, -22], [34, -48], [76, 0]], '#8b7355'); poli(ctx, [[-30, -62], [-18, -40], [-40, -38]], '#a68d6c'); poli(ctx, [[34, -48], [42, -32], [26, -30]], '#a68d6c');
  rect(ctx, -6, -66, 6, 66, '#6b4a2f'); rect(ctx, 14, -66, 6, 66, '#6b4a2f'); linea(ctx, -3, -66, 17, 0, '#6b4a2f', 3); linea(ctx, 17, -66, -3, 0, '#6b4a2f', 3);
  circ(ctx, 7, -72, 10, '#444'); circ(ctx, 7, -72, 4, '#999'); rect(ctx, -10, -64, 34, 4, '#6b4a2f');
  rect(ctx, 30, -14, 30, 6, '#555'); rect(ctx, 34, -26, 22, 13, '#7a5a3a'); circ(ctx, 38, -7, 3, '#222'); circ(ctx, 54, -7, 3, '#222');
  linea(ctx, 28, -3, 66, -3, '#777', 2);
  circ(ctx, 45, -29, 3.4, o.diamantes ? '#7de3ff' : '#6b6b6b'); circ(ctx, 51, -28, 3, o.diamantes ? '#b7f0ff' : '#555');
  if (o.diamantes) { simbolo(ctx, 'diamante', -46, -24, 7, '#7de3ff'); simbolo(ctx, 'diamante', -26, -14, 5, '#b7f0ff'); }
}
function granja(ctx, o) {
  const { n } = o;
  sombra(ctx, 78, 9);
  caja(ctx, -64, 0, 70, 40, 24, '#c0392b');
  poli(ctx, [[-68, -40], [-29, -66], [10, -40]], '#7f1d1d'); poli(ctx, [[10, -40], [-29, -66], [-14, -70], [30, -50]], '#9a2a22');
  rect(ctx, -44, -28, 26, 28, '#fff'); linea(ctx, -44, -28, -18, 0, '#c0392b', 2); linea(ctx, -18, -28, -44, 0, '#c0392b', 2); rect(ctx, -44, -28, 26, 2, '#c0392b');
  rect(ctx, 28, -62, 18, 62, '#cfd6dd'); elip(ctx, 37, -62, 9, 4, '#e5e7eb'); ctx.beginPath(); ctx.arc(37, -62, 9, PI, 0); ctx.fillStyle = '#9aa5b1'; ctx.fill();
  for (let i = 0; i < 6; i++) { rect(ctx, 56 + i * 5, -14, 2, 14, '#c9a46a'); }
  rect(ctx, 54, -12, 32, 2, '#c9a46a'); rect(ctx, 54, -6, 32, 2, '#c9a46a');
  elip(ctx, -56, 6, 9, 5, '#f1e0a8');
  if (n >= 1) { elip(ctx, 66, 4, 9, 5, '#fff'); circ(ctx, 72, 1, 3, '#222'); }
}
function invernadero(ctx, o) {
  sombra(ctx, 78, 9);
  const w = 128;
  rect(ctx, -w / 2, -26, w, 26, 'rgba(190,235,250,0.75)');
  ctx.beginPath(); ctx.moveTo(-w / 2, -26); ctx.quadraticCurveTo(0, -62, w / 2, -26); ctx.closePath(); ctx.fillStyle = 'rgba(205,240,252,0.8)'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,120,140,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i <= 6; i++) { const x = -w / 2 + i * w / 6; linea(ctx, x, -26, x, 0, 'rgba(80,120,140,0.8)', 1.2); }
  for (let i = 0; i < 6; i++) { const x = -w / 2 + 10 + i * 20; circ(ctx, x, -12, 5, '#3fa34d'); circ(ctx, x + 4, -16, 4, '#58c466'); circ(ctx, x, -6, 3, o.fruta || '#e5503c'); }
  rect(ctx, -w / 2, -2, w, 2, '#6b4a2f');
}
function puerto(ctx, o) {
  const mundial = !!o.mundial;
  elip(ctx, 0, -2, 82, 16, '#3a86c9'); elip(ctx, 0, -2, 82, 16, 'rgba(255,255,255,0.08)');
  [[-40, -4], [10, 2], [48, -6]].forEach(([x, y]) => linea(ctx, x - 12, y, x + 12, y, 'rgba(255,255,255,0.45)', 1.5));
  rect(ctx, -76, -16, 152, 8, '#a8a29e'); rect(ctx, -76, -18, 152, 3, '#d6d3d1');
  if (o.pesca) {
    poli(ctx, [[-30, -10], [20, -10], [28, -22], [-38, -22]], '#d9534f'); rect(ctx, -24, -36, 24, 14, '#f1f5f9'); ventana(ctx, -20, -33, 7, 7); ventana(ctx, -10, -33, 7, 7);
    rect(ctx, 6, -52, 2, 30, '#555'); linea(ctx, 7, -52, 36, -26, '#555', 1.5); ctx.strokeStyle = 'rgba(80,60,40,0.8)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(36 - i * 2, -26); ctx.lineTo(40 - i * 3, -8); ctx.stroke(); }
    rect(ctx, 44, -30, 20, 14, '#d4a15a'); circ(ctx, 50, -24, 3, '#9ac'); circ(ctx, 58, -24, 3, '#9ac'); return;
  }
  const cols = ['#d9534f', '#3b82f6', '#f59e0b', '#22a06b', '#8b5cf6', '#e879a8'];
  const pilas = mundial ? 5 : 3;
  for (let i = 0; i < pilas; i++) for (let j = 0; j < (mundial ? 3 : 2); j++) { const x = -70 + i * 22, y = -18 - j * 9; rect(ctx, x, y - 9, 20, 9, cols[(i + j * 2) % cols.length]); rect(ctx, x, y - 9, 20, 2, 'rgba(255,255,255,0.3)'); linea(ctx, x + 6, y - 9, x + 6, y, 'rgba(0,0,0,0.2)', 1); linea(ctx, x + 13, y - 9, x + 13, y, 'rgba(0,0,0,0.2)', 1); }
  const grua = (x) => { rect(ctx, x, -70, 4, 54, '#e23b4a'); rect(ctx, x + 22, -70, 4, 54, '#e23b4a'); rect(ctx, x - 6, -74, 70, 6, '#e23b4a'); linea(ctx, x + 4, -70, x + 22, -16, '#b91c1c', 1.5); linea(ctx, x + 50, -68, x + 50, -40, '#444', 1); rect(ctx, x + 46, -40, 8, 6, '#666'); };
  grua(mundial ? 26 : 30); if (mundial) grua(-4);
  poli(ctx, [[18, 4], [74, 4], [66, -8], [26, -8]], '#2b3a4f'); rect(ctx, 30, -22, 30, 14, '#e5e7eb'); rect(ctx, 30, -22, 30, 3, '#e23b4a'); ventana(ctx, 34, -18, 6, 6); ventana(ctx, 44, -18, 6, 6);
}
function crucero(ctx, o) {
  const { n } = o;
  elip(ctx, 0, -2, 84, 17, '#3a86c9'); [[-50, -2], [40, 2]].forEach(([x, y]) => linea(ctx, x - 12, y, x + 12, y, 'rgba(255,255,255,0.5)', 1.5));
  poli(ctx, [[-76, -16], [70, -16], [58, 2], [-62, 2]], '#1f2d4a'); poli(ctx, [[70, -16], [84, -20], [62, 2], [58, 2]], '#1f2d4a'); rect(ctx, -74, -12, 140, 3, '#e23b4a');
  for (let p = 0; p < 3 + (n >= 2 ? 1 : 0); p++) { rect(ctx, -62 + p * 5, -28 - p * 11, 116 - p * 14, 11, '#f8fafc'); for (let i = 0; i < 12 - p; i++) rect(ctx, -56 + p * 5 + i * 9.5 * (1 + p * 0.05), -25 - p * 11, 5, 4, '#7dc4f0'); }
  rect(ctx, -20, -62, 14, 20, '#e23b4a'); rect(ctx, -20, -62, 14, 4, '#222'); rect(ctx, 6, -62, 14, 20, '#e23b4a'); rect(ctx, 6, -62, 14, 4, '#222');
  humo(ctx, -13, -64); linea(ctx, 40, -50, 40, -70, '#555', 1.5); poli(ctx, [[40, -70], [52, -66], [40, -62]], '#f5c04a');
}
function avion(ctx, x, y, s = 1, col = '#f1f5f9') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -26, -9, 52, 10, 5, col); poli(ctx, [[26, -9], [34, -3], [26, 1]], col);
  poli(ctx, [[-26, -8], [-34, -22], [-26, -22], [-14, -8]], '#e23b4a'); poli(ctx, [[-6, -3], [10, -3], [-2, 14], [-12, 14]], tono(col, 0.85)); poli(ctx, [[-6, -8], [10, -8], [-2, -22], [-12, -22]], tono(col, 0.9));
  for (let i = 0; i < 6; i++) rect(ctx, -18 + i * 6, -7, 3, 3, '#4a90c2');
  ctx.restore();
}
function aeropuerto(ctx, o) {
  const chico = !!o.chico;
  sombra(ctx, 78, 9);
  poli(ctx, [[-76, 4], [76, 4], [66, -8], [-66, -8]], '#4b5563'); for (let i = 0; i < 6; i++) rect(ctx, -56 + i * 20, -3, 10, 1.6, '#e5e7eb');
  if (chico) {
    caja(ctx, -64, -8, 52, 24, 14, '#cbd5e1'); poli(ctx, [[-68, -32], [-48, -44], [-8, -34], [-8, -32]], '#475569'); ventanas(ctx, -62, -30, 46, 14, 1, 5, '#a9d8f5', 3);
    rect(ctx, -64, -8, 14, 0, '#fff'); avion(ctx, 22, -22, 1.1);
    return;
  }
  caja(ctx, -70, -8, 70, 26, 16, '#e5e7eb'); ventanas(ctx, -68, -32, 66, 16, 1, 7, '#a9d8f5', 3); rect(ctx, -70, -34, 70, 4, '#475569');
  rect(ctx, 14, -60, 8, 52, '#9ca3af'); rrect(ctx, 6, -78, 24, 18, 4, '#475569'); ventana(ctx, 9, -75, 18, 8, '#bfe3ff'); circ(ctx, 18, -81, 2.5, '#e23b4a');
  avion(ctx, 44, -22, 1.05);
}
function deposito(ctx, o) {
  const v = o.v;
  rrect(ctx, -78, -22, 156, 24, 6, '#4b5563'); for (let i = 0; i < 7; i++) rect(ctx, -66 + i * 22, -12, 12, 1.6, '#e5e7eb');
  const { c } = o;
  if (v === 'taxi') { [[-42, -16], [0, -6], [42, -16]].forEach(([x, y], i) => coche(ctx, x, y + 14, i === 1 ? '#f5c04a' : '#f2b01e', 1.8)); [[-42], [0], [42]].forEach(([x]) => rect(ctx, x - 5, -37, 10, 4, '#fff')); poli(ctx, [[-72, -22], [-72, -52], [-50, -52], [-50, -22]], 'none'); cartel(ctx, -74, -62, 32, 12, '#f5c04a', 'estrella', '#222'); rect(ctx, -60, -50, 3, 28, '#777'); }
  else if (v === 'bus') {
    [[-36, '#e23b4a'], [34, '#f59e0b']].forEach(([x, col]) => { rrect(ctx, x - 34, -42, 68, 34, 6, col); for (let i = 0; i < 6; i++) rect(ctx, x - 29 + i * 10, -37, 7, 10, '#bfe6ff'); rect(ctx, x - 34, -14, 68, 3, 'rgba(0,0,0,0.2)'); circ(ctx, x - 20, -8, 5, '#222'); circ(ctx, x + 20, -8, 5, '#222'); circ(ctx, x - 20, -8, 2, '#999'); circ(ctx, x + 20, -8, 2, '#999'); });
    cartel(ctx, -18, -62, 36, 12, c.acento, 'estrella', '#fff'); rect(ctx, -1, -50, 2, 8, '#777');
  } else if (v === 'camion') {
    rrect(ctx, -70, -48, 76, 40, 4, '#e5e7eb'); rect(ctx, -70, -48, 76, 4, '#cbd5e1'); rrect(ctx, 6, -36, 36, 28, 4, '#e23b4a'); rect(ctx, 28, -32, 12, 12, '#bfe6ff');
    [-52, -30, 20, 34].forEach((x) => { circ(ctx, x, -6, 6, '#222'); circ(ctx, x, -6, 2.5, '#999'); });
    rrect(ctx, 46, -30, 28, 22, 3, '#d4a15a'); rect(ctx, 46, -22, 28, 2, 'rgba(0,0,0,0.2)');
  } else if (v === 'van') {
    rrect(ctx, -64, -42, 54, 32, 5, '#f8fafc'); rect(ctx, -64, -26, 54, 6, c.acento); rrect(ctx, -12, -34, 22, 24, 4, '#f8fafc'); rect(ctx, -2, -31, 10, 10, '#bfe6ff'); circ(ctx, -50, -9, 5, '#222'); circ(ctx, 0, -9, 5, '#222');
    [[24, -12], [44, -12], [34, -24]].forEach(([x, y]) => { rect(ctx, x, y - 11, 18, 12, '#d4a15a'); rect(ctx, x, y - 11, 18, 2, 'rgba(0,0,0,0.25)'); rect(ctx, x + 8, y - 11, 2, 12, '#a47a3a'); });
  } else if (v === 'bici') {
    [-44, 0, 44].forEach((x, i) => { circ(ctx, x - 12, -9, 8, '#333'); circ(ctx, x - 12, -9, 5, '#bbb'); circ(ctx, x + 12, -9, 8, '#333'); circ(ctx, x + 12, -9, 5, '#bbb'); rect(ctx, x - 6, -28, 22, 14, [c.acento, '#f5c04a', '#22a06b'][i]); linea(ctx, x - 12, -9, x - 4, -28, '#555', 2); linea(ctx, x + 14, -9, x + 14, -28, '#555', 2); poli(ctx, [[x - 8, -40], [x + 18, -40], [x + 16, -28], [x - 6, -28]], tono([c.acento, '#f5c04a', '#22a06b'][i], 0.85)); });
  } else if (v === 'tren') {
    rect(ctx, -78, -4, 156, 3, '#444'); for (let i = 0; i < 16; i++) rect(ctx, -76 + i * 10, -3, 4, 3, '#7a5a3a');
    rrect(ctx, 14, -36, 54, 32, 6, '#e23b4a'); rect(ctx, 20, -32, 20, 12, '#bfe6ff'); poli(ctx, [[68, -36], [78, -18], [68, -4]], '#b91c1c'); rect(ctx, 44, -46, 12, 10, '#444'); humo(ctx, 50, -48);
    [[-70, '#3b82f6'], [-34, '#f59e0b']].forEach(([x, col]) => { rrect(ctx, x, -34, 32, 30, 4, col); for (let i = 0; i < 3; i++) rect(ctx, x + 4 + i * 9, -28, 6, 9, '#bfe6ff'); });
    [26, 56, -62, -50, -26, -14].forEach((x) => circ(ctx, x, -4, 3.6, '#222'));
  } else if (v === 'foodtruck') {
    rrect(ctx, -52, -50, 80, 40, 6, c.acento); rect(ctx, -44, -42, 40, 18, '#ffe9a8'); toldo(ctx, -46, -46, 44, 8, '#fff', c.acento, 5); rrect(ctx, 28, -38, 26, 28, 5, tono(c.acento, 1.15)); rect(ctx, 36, -34, 14, 12, '#bfe6ff'); circ(ctx, -30, -9, 6, '#222'); circ(ctx, 38, -9, 6, '#222');
    simbolo(ctx, 'estrella', -10, -34, 5, c.acento);
  }
}
function gasolinera(ctx, o) {
  const { c } = o;
  sombra(ctx, 78, 9);
  rect(ctx, -70, -6, 140, 6, '#6b7280');
  caja(ctx, 24, 0, 40, 30, 16, '#f1f5f9'); ventana(ctx, 30, -24, 28, 16, '#bfe6ff'); rect(ctx, 22, -34, 46, 5, c.acento);
  [-52, -8].forEach((x) => rect(ctx, x, -52, 4, 52, '#cbd5e1'));
  rect(ctx, -60, -62, 66, 12, '#f8fafc'); rect(ctx, -60, -53, 66, 4, '#e23b4a'); rect(ctx, -60, -62, 66, 3, '#cbd5e1');
  cartel(ctx, -54, -76, 20, 12, '#e23b4a', 'rayo', '#fff');
  [-38, 14 - 6].forEach((x) => { rrect(ctx, x - 5, -26, 11, 26, 2, '#e23b4a'); rect(ctx, x - 3, -22, 7, 8, '#bfe6ff'); });
  coche(ctx, -4, 14, '#3b82f6', 1.5);
}
function hotel(ctx, o) {
  const { c, n } = o, pisos = (o.pisos || 5) + (o.pisos ? 0 : n), w = o.pisos && o.pisos <= 2 ? 90 : 84, x = -w / 2 - 6, alto = pisos * 17 + 14;
  sombra(ctx, w / 2 + 28);
  caja(ctx, x, 0, w, alto, 26, o.dorado ? '#f3e6c4' : c.pared);
  for (let p = 0; p < pisos; p++) { ventanas(ctx, x + 3, -alto + 4 + p * 17, w - 6, 17, 1, 5, '#a9d8f5', 3); rect(ctx, x, -alto + 4 + p * 17 + 14, w, 2, 'rgba(0,0,0,0.12)'); }
  rect(ctx, x - 2, -alto, w + 4, 5, tono(c.techo, 0.95));
  cartel(ctx, x + w / 2 - 17, -alto - 14, 34, 13, c.acento, 'estrella', '#fff');
  toldo(ctx, x + w / 2 - 20, -26, 40, 9, c.acento, '#fff', 5); puerta(ctx, x + w / 2 - 8, -20, 16, 20, '#7a4a2a');
  if (o.playa) { palmera(ctx, x + w + 18, 0, 1); palmera(ctx, x - 14, 2, 0.85); elip(ctx, x + w + 4, 8, 22, 6, '#67c1f0'); elip(ctx, x + w + 2, 7, 16, 3, 'rgba(255,255,255,0.4)'); }
  else { arbol(ctx, x - 12, 2, 0.8); arbol(ctx, x + w + 16, 2, 0.8); }
  if (o.dorado) rect(ctx, x - 2, -alto, w + 4, 3, '#f5c04a');
}
function cabanas(ctx, o) {
  const { n } = o, cant = 2 + (n >= 2 ? 1 : 0);
  sombra(ctx, 72, 9);
  for (let i = 0; i < cant; i++) {
    const x = (i - (cant - 1) / 2) * 52 - 24;
    caja(ctx, x, 0, 46, 30, 14, '#a9703f'); for (let k = 1; k < 5; k++) rect(ctx, x, -k * 6, 46, 1, 'rgba(0,0,0,0.2)');
    poli(ctx, [[x - 5, -30], [x + 23, -54], [x + 51, -30]], '#7f3d26'); poli(ctx, [[x + 51, -30], [x + 23, -54], [x + 31, -56], [x + 60, -34]], '#6a2f1c');
    puerta(ctx, x + 17, -20, 12, 20, '#5b3a22'); ventana(ctx, x + 3, -22, 11, 11, '#ffe9a8'); ventana(ctx, x + 32, -22, 11, 11, '#ffe9a8');
  }
  arbol(ctx, -66, 2, 0.95, '#2f8f4e'); arbol(ctx, 68, 4, 0.85, '#2f8f4e');
}
function camping(ctx, o) {
  const { n } = o, cols = ['#e5503c', '#3b82f6', '#f59e0b'];
  sombra(ctx, 70, 9);
  for (let i = 0; i < 2 + (n >= 1 ? 1 : 0); i++) { const x = -44 + i * 46; poli(ctx, [[x - 24, 0], [x, -44], [x + 24, 0]], cols[i]); poli(ctx, [[x - 6, 0], [x, -26], [x + 6, 0]], 'rgba(0,0,0,0.45)'); poli(ctx, [[x, -44], [x + 24, 0], [x + 12, 0]], 'rgba(0,0,0,0.18)'); }
  arbol(ctx, -68, 2, 1, '#2f8f4e'); arbol(ctx, 70, 2, 0.9, '#2f8f4e');
  poli(ctx, [[34, 0], [42, -14], [50, 0]], '#ff8a1a'); poli(ctx, [[38, 0], [42, -8], [46, 0]], '#ffd24a'); linea(ctx, 30, 2, 54, -2, '#6b4a2f', 3);
}
function neon(ctx, o) {
  const { c, n } = o, w = 108 + n * 4, x = -w / 2 - 6, alto = 62, col = o.dorado ? '#f5c04a' : c.acento;
  sombra(ctx, w / 2 + 14);
  caja(ctx, x, 0, w, alto, 26, o.dorado ? '#3a2c1a' : '#2b2f45');
  rect(ctx, x, -alto, w, 4, tono(col, 0.7));
  for (let i = 0; i < 9; i++) circ(ctx, x + 6 + i * (w - 12) / 8, -alto + 2, 2, i % 2 ? '#fff6a8' : col);
  elip(ctx, x + w / 2, -38, w * 0.46, 15, alfa(col, 0.18));
  cartel(ctx, x + 12, -52, w - 24, 22, tono(col, 0.55), null); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x + 14, -50, w - 28, 18);
  if (o.disco) { circ(ctx, x + w / 2, -41, 7, '#cbd5e1'); for (let i = 0; i < 6; i++) { const a = i * PI / 3; circ(ctx, x + w / 2 + Math.cos(a) * 3.4, -41 + Math.sin(a) * 3.4, 1.1, ['#f0f', '#0ff', '#ff0'][i % 3]); } [-1, 1].forEach((d) => poli(ctx, [[x + w / 2, -34], [x + w / 2 + d * 30, -4], [x + w / 2 + d * 14, -4]], 'rgba(255,255,255,0.12)')); }
  else simbolo(ctx, o.sim || 'estrella', x + w / 2, -41, 8, col);
  ventana(ctx, x + 8, -22, 24, 18, alfa(col, 0.6)); ventana(ctx, x + w - 32, -22, 24, 18, alfa(col, 0.6)); puerta(ctx, x + w / 2 - 8, -22, 16, 22, '#111');
  rect(ctx, x + w / 2 - 14, -22, 28, 2, col);
}
function campo(ctx, o) {
  const { c } = o;
  sombra(ctx, 78, 9);
  poli(ctx, [[-70, 0], [64, 0], [78, -20], [-56, -20]], '#5fae5f'); poli(ctx, [[-70, 0], [64, 0], [64, 4], [-70, 4]], '#3f7f3f');
  [[-40, -6, '#e23b4a'], [-4, -12, '#3b82f6'], [32, -6, '#f59e0b'], [10, -4, '#a855f7']].forEach(([x, y, col]) => { poli(ctx, [[x - 11, y], [x - 8, y - 22], [x + 8, y - 22], [x + 11, y]], col); rect(ctx, x - 8, y - 22, 16, 3, 'rgba(255,255,255,0.3)'); });
  linea(ctx, 54, 0, 54, -40, '#777', 2); poli(ctx, [[54, -40], [70, -34], [54, -28]], c.acento);
}
function parque(ctx, o) {
  const { n } = o;
  sombra(ctx, 78, 9);
  ctx.strokeStyle = '#e23b4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-76, 0); ctx.bezierCurveTo(-62, -48, -48, -48, -34, -4); ctx.bezierCurveTo(-26, -50, -10, -40, 0, 0); ctx.stroke();
  for (let x = -70; x < 0; x += 14) linea(ctx, x, -(x < -34 ? 4 + Math.sin((x + 76) / 42 * PI) * 36 : 4 + Math.sin((x + 34) / 34 * PI) * 34), x, 0, '#9ca3af', 1.3);
  const cx = 36, cy = -52, R = 40; ctx.strokeStyle = '#475569'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, PI * 2); ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; linea(ctx, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, '#64748b', 1.5); rrect(ctx, cx + Math.cos(a) * R - 5, cy + Math.sin(a) * R - 4, 10, 8, 2, ['#e23b4a', '#3b82f6', '#f59e0b', '#22a06b'][i % 4]); }
  linea(ctx, cx, cy, cx - 16, 0, '#475569', 3); linea(ctx, cx, cy, cx + 16, 0, '#475569', 3); circ(ctx, cx, cy, 4, '#f5c04a');
  for (let i = 0; i < 3 + n; i++) circ(ctx, -76 + i * 8, -78 + (i % 2) * 6, 3.5, ['#e23b4a', '#3b82f6', '#f5c04a', '#22a06b', '#a855f7'][i % 5]);
}
function acuatico(ctx, o) {
  const { n } = o;
  sombra(ctx, 78, 9);
  elip(ctx, -8, -4, 66, 15, '#7fd1f5'); elip(ctx, -8, -4, 66, 15, 'rgba(255,255,255,0.15)'); elip(ctx, -20, -6, 22, 5, 'rgba(255,255,255,0.4)');
  rect(ctx, 38, -62, 8, 62, '#cbd5e1'); rrect(ctx, 30, -70, 24, 10, 3, '#e23b4a');
  ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.strokeStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(34, -62); ctx.bezierCurveTo(-10, -60, 50, -34, 8, -12); ctx.stroke();
  ctx.strokeStyle = '#a855f7'; ctx.beginPath(); ctx.moveTo(46, -56); ctx.bezierCurveTo(74, -48, 60, -20, 36, -8); ctx.stroke(); ctx.lineCap = 'butt';
  if (n >= 1) { ctx.lineWidth = 7; ctx.strokeStyle = '#22a06b'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(34, -46); ctx.bezierCurveTo(10, -44, 22, -26, -2, -10); ctx.stroke(); ctx.lineCap = 'butt'; }
  palmera(ctx, -62, 0, 0.8);
  circ(ctx, -30, -6, 3.4, '#ffd24a'); circ(ctx, -20, -4, 3.4, '#ff6fa8');
}
function zoo(ctx, o) {
  const { c } = o;
  sombra(ctx, 78, 9);
  rect(ctx, -70, -34, 140, 4, '#a47a4a'); for (let i = 0; i < 14; i++) rect(ctx, -68 + i * 10, -34, 3, 34, '#a47a4a');
  rect(ctx, -26, -50, 6, 50, '#8a5a30'); rect(ctx, 20, -50, 6, 50, '#8a5a30'); rrect(ctx, -32, -66, 64, 18, 4, '#2f8f4e'); simbolo(ctx, 'pata', 0, -57, 6.5, '#fff6d6');
  rect(ctx, -22, -30, 3, 30, '#8a5a30'); rect(ctx, 19, -30, 3, 30, '#8a5a30');
  elip(ctx, -50, -22, 12, 8, '#e0a83a'); rect(ctx, -56, -30, 3, 14, '#e0a83a'); rect(ctx, -46, -30, 3, 14, '#e0a83a'); rect(ctx, -58, -62, 5, 40, '#e0a83a'); circ(ctx, -54, -65, 6, '#e0a83a'); rect(ctx, -62, -73, 3, 6, '#8a5a30');
  elip(ctx, 52, -18, 16, 11, '#9ca3af'); circ(ctx, 66, -22, 7, '#9ca3af'); rect(ctx, 68, -22, 4, 16, '#9ca3af'); rect(ctx, 40, -10, 5, 10, '#9ca3af'); rect(ctx, 58, -10, 5, 10, '#9ca3af'); circ(ctx, 64, -24, 1.3, '#222');
  arbol(ctx, -4, -30, 0.7, '#3f9e55'); void c;
}
function estadio(ctx, o) {
  const { c, n } = o, futbol = !!o.futbol;
  sombra(ctx, 82, 11);
  elip(ctx, 0, -16, 78, 28, '#cbd5e1'); elip(ctx, 0, -22, 78, 28, '#e5e7eb');
  ctx.beginPath(); ctx.ellipse(0, -22, 78, 28, 0, 0, PI); ctx.lineTo(-78, -22); ctx.fillStyle = futbol ? '#c0392b' : '#94a3b8'; ctx.fill();
  elip(ctx, 0, -26, 62, 19, '#4aa564'); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(-40, -38, 80, 24); linea(ctx, 0, -38, 0, -14, 'rgba(255,255,255,0.8)', 1.5); ctx.beginPath(); ctx.arc(0, -26, 7, 0, PI * 2); ctx.stroke();
  for (let i = 0; i < 16; i++) { const a = PI * (i / 15); circ(ctx, Math.cos(a) * 71, -22 + Math.sin(a) * 25, 2, ['#e23b4a', '#f5c04a', '#3b82f6', '#fff'][i % 4]); }
  [[-76, -14], [76, -14]].forEach(([x, y]) => { rect(ctx, x - 2, y - 52, 4, 50, '#9ca3af'); rect(ctx, x - 8, y - 58, 16, 8, '#fff6a8'); });
  cartel(ctx, -24, -62, 48, 13, c.acento, futbol ? 'pelota' : 'estrella', '#fff'); if (n >= 2) rect(ctx, -26, -64, 52, 3, '#f5c04a');
}
function banco(ctx, o) {
  const { c, n } = o, w = (o.chico ? 100 : 118) + n * 3, x = -w / 2 - 5, alto = 50;
  sombra(ctx, w / 2 + 16);
  caja(ctx, x, 0, w, alto, 22, '#e7e0cf');
  const cols = o.chico ? 4 : 6; for (let i = 0; i < cols; i++) { const cx = x + 8 + i * ((w - 22) / (cols - 1)); rect(ctx, cx, -alto + 4, 8, alto - 10, '#fbf8ef'); rect(ctx, cx + 5, -alto + 4, 3, alto - 10, 'rgba(0,0,0,0.12)'); rect(ctx, cx - 1, -alto + 2, 10, 3, '#d6cdb6'); rect(ctx, cx - 1, -8, 10, 3, '#d6cdb6'); }
  poli(ctx, [[x - 4, -alto], [x + w / 2, -alto - 26], [x + w + 4, -alto]], '#d6cdb6'); poli(ctx, [[x + 8, -alto - 1], [x + w / 2, -alto - 21], [x + w - 8, -alto - 1]], '#efe9d8');
  if (o.bolsa) { ctx.strokeStyle = c.acento; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + w / 2 - 14, -alto - 6); ctx.lineTo(x + w / 2 - 4, -alto - 12); ctx.lineTo(x + w / 2 + 2, -alto - 8); ctx.lineTo(x + w / 2 + 14, -alto - 18); ctx.stroke(); }
  else simbolo(ctx, o.sim || 'moneda', x + w / 2, -alto - 11, 6.5, c.acento);
  for (let s = 0; s < 3; s++) rect(ctx, x + 4 + s * 3, -2 - s * 0, w - 8 - s * 6, 2, '#cfc6ad');
  puerta(ctx, x + w / 2 - 8, -26, 16, 24, '#6b4a2f');
}
function teatro(ctx, o) {
  const { c, n } = o, w = 112 + n * 3, x = -w / 2 - 6, alto = 62;
  sombra(ctx, w / 2 + 16);
  if (o.museo) {
    caja(ctx, x, 0, w, 46, 22, '#efe7d3'); for (let i = 0; i < 6; i++) rect(ctx, x + 8 + i * ((w - 24) / 5), -42, 8, 38, '#fffaf0');
    poli(ctx, [[x - 4, -46], [x + w / 2, -68], [x + w + 4, -46]], '#d9cfb5'); ctx.beginPath(); ctx.arc(x + w / 2, -68, 16, PI, 0); ctx.fillStyle = '#7fb09a'; ctx.fill(); rect(ctx, x + w / 2 - 1, -92, 2, 8, '#777');
    puerta(ctx, x + w / 2 - 8, -24, 16, 22, '#6b4a2f'); return;
  }
  caja(ctx, x, 0, w, alto, 26, o.dorado ? '#3a2c1a' : '#7c3a4a');
  rect(ctx, x, -alto, w, 4, '#f5c04a');
  rrect(ctx, x + 10, -50, w - 20, 22, 3, '#111827'); ctx.strokeStyle = '#f5c04a'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 12, -48, w - 24, 18);
  for (let i = 0; i < 10; i++) { circ(ctx, x + 14 + i * (w - 28) / 9, -50, 1.8, '#fff6a8'); circ(ctx, x + 14 + i * (w - 28) / 9, -28, 1.8, '#fff6a8'); }
  if (o.cine) { rect(ctx, x + w / 2 - 14, -44, 28, 10, '#f5c04a'); for (let i = 0; i < 5; i++) rect(ctx, x + w / 2 - 12 + i * 5.4, -43, 3, 8, '#111'); } else { simbolo(ctx, 'estrella', x + w / 2, -39, 7, '#f5c04a'); }
  rect(ctx, x + 8, -24, 24, 24, '#e8d9c0'); rect(ctx, x + 11, -21, 18, 18, c.acento); rect(ctx, x + w - 32, -24, 24, 24, '#e8d9c0'); rect(ctx, x + w - 29, -21, 18, 18, tono(c.acento, 1.25));
  puerta(ctx, x + w / 2 - 9, -24, 18, 24, '#2a0f18'); rect(ctx, x + w / 2 - 12, -2, 24, 3, '#c0392b');
}
function mall(ctx, o) {
  const { c, n } = o, mega = !!o.mega, w = (mega ? 146 : o.chico ? 112 : 134) + n * 2, x = -w / 2 - 6, alto = mega ? 70 : 56;
  sombra(ctx, w / 2 + 14);
  caja(ctx, x, 0, w, alto, 22, c.pared);
  rect(ctx, x, -alto, w, 4, tono(c.techo, 0.95));
  const cw = w * 0.34; rect(ctx, x + w / 2 - cw / 2, -alto - 8, cw, alto + 8, 'rgba(160,220,245,0.8)'); for (let i = 1; i < 5; i++) rect(ctx, x + w / 2 - cw / 2 + i * cw / 5, -alto - 8, 1.5, alto + 8, 'rgba(60,100,130,0.6)'); rect(ctx, x + w / 2 - cw / 2, -alto - 10, cw, 3, c.acento);
  cartel(ctx, x + w / 2 - 22, -alto - 24, 44, 14, c.acento, o.chico ? 'moneda' : 'estrella', '#fff');
  ventanas(ctx, x + 4, -alto + 12, w / 2 - cw / 2 - 6, alto - 28, mega ? 2 : 1, 3, '#a9d8f5', 3); ventanas(ctx, x + w / 2 + cw / 2 + 2, -alto + 12, w / 2 - cw / 2 - 6, alto - 28, mega ? 2 : 1, 3, '#a9d8f5', 3);
  puerta(ctx, x + w / 2 - 12, -22, 24, 22, '#37506a');
  coche(ctx, x + 18, 14, '#e23b4a', 1.3); coche(ctx, x + w - 24, 16, '#3b82f6', 1.3); if (mega) coche(ctx, x + w / 2, 18, '#f5c04a', 1.3);
}
function isla(ctx, o) {
  const { n } = o;
  elip(ctx, 0, -2, 86, 18, '#48a3e0'); elip(ctx, 0, -4, 70, 13, '#6fd0f0'); elip(ctx, 0, -6, 56, 10, '#f1dfa4'); elip(ctx, 0, -8, 40, 6, '#e6c987');
  palmera(ctx, -34, -8, 1.15); palmera(ctx, 38, -6, 1.05); palmera(ctx, 8, -10, 0.85);
  caja(ctx, -16, -8, 30, 18, 10, '#f8e8c4'); poli(ctx, [[-20, -26], [-1, -38], [20, -26]], '#c97b34'); ventana(ctx, -12, -22, 9, 9, '#ffe9a8'); puerta(ctx, 1, -20, 9, 12, '#7a4a2a');
  poli(ctx, [[54, 2], [76, 2], [72, 8], [58, 8]], '#8a5a30'); rect(ctx, 64, -16, 1.6, 18, '#777'); poli(ctx, [[65, -16], [76, -6], [65, -6]], '#fff');
  if (n >= 1) { rect(ctx, -70, -3, 22, 3, '#a47a4a'); rect(ctx, -70, -3, 3, 8, '#7a5a3a'); }
}
function espacial(ctx, o) {
  const { n } = o;
  sombra(ctx, 74, 9);
  rect(ctx, -70, -6, 140, 6, '#6b7280'); rect(ctx, -70, -8, 140, 3, '#9ca3af');
  if (o.satelite) {
    rect(ctx, -2, -50, 4, 44, '#777'); ctx.beginPath(); ctx.ellipse(-20, -56, 30, 12, -0.5, 0, PI * 2); ctx.fillStyle = '#e5e7eb'; ctx.fill(); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.stroke(); linea(ctx, -20, -56, 0, -76, '#777', 2); circ(ctx, 0, -76, 3, '#e23b4a');
    rect(ctx, 30, -76, 28, 12, '#2b4a8a'); rect(ctx, 30, -76, 28, 2, '#5b8ae0'); for (let i = 1; i < 4; i++) rect(ctx, 30 + i * 7, -76, 1, 12, '#5b8ae0'); rrect(ctx, 20, -74, 12, 8, 2, '#d1d5db'); rrect(ctx, 56, -74, 12, 8, 2, '#d1d5db');
    rect(ctx, -56, -18, 24, 12, '#cbd5e1'); return;
  }
  rect(ctx, 22, -100, 6, 94, '#e23b4a'); for (let y = -96; y < -8; y += 22) { linea(ctx, 22, y, 28, y + 22, '#9b1c1c', 1.5); } rect(ctx, 6, -86, 16, 3, '#e23b4a'); rect(ctx, 6, -60, 16, 3, '#e23b4a');
  rrect(ctx, -22, -90, 26, 84, 12, '#f8fafc'); poli(ctx, [[-22, -78], [-9, -118], [4, -78]], '#e23b4a'); rect(ctx, -22, -50, 26, 5, '#e23b4a'); circ(ctx, -9, -66, 6, '#7dc4f0'); circ(ctx, -9, -66, 6, 'rgba(255,255,255,0.15)');
  poli(ctx, [[-22, -30], [-38, -6], [-22, -6]], '#e23b4a'); poli(ctx, [[4, -30], [20, -6], [4, -6]], '#e23b4a');
  poli(ctx, [[-20, -6], [-9, 12], [2, -6]], alfa('#ff9a2a', 0.8)); poli(ctx, [[-16, -6], [-9, 4], [-2, -6]], alfa('#ffe27a', 0.9));
  rect(ctx, -66, -34, 30, 28, '#cbd5e1'); ventanas(ctx, -64, -32, 26, 12, 1, 3, '#7dc4f0', 2); if (o.cohete || n >= 1) { circ(ctx, 52, -30, 6, '#fff'); circ(ctx, 52, -30, 3, '#e23b4a'); }
}
function castillo(ctx, o) {
  const { n } = o;
  sombra(ctx, 78, 10);
  caja(ctx, -64, 0, 128, 28, 16, '#c9c2b0');
  for (let i = 0; i < 9; i++) rect(ctx, -64 + i * 14.5, -33, 8, 6, '#c9c2b0');
  const torre = (x, h, w, col) => { rect(ctx, x - w / 2, -h, w, h, col); rect(ctx, x + w / 2 - 6, -h, 6, h, 'rgba(0,0,0,0.14)'); poli(ctx, [[x - w / 2 - 4, -h], [x, -h - 28], [x + w / 2 + 4, -h]], '#b53a4a'); rect(ctx, x - 0.8, -h - 40, 1.6, 14, '#555'); poli(ctx, [[x + 1, -h - 40], [x + 11, -h - 36], [x + 1, -h - 32]], '#f5c04a'); rect(ctx, x - 3, -h + 14, 6, 11, '#2b2b3a'); };
  torre(-56, 62, 24, '#d6cfbd'); torre(56, 62, 24, '#d6cfbd'); torre(0, 86 + n * 4, 36, '#dcd5c3');
  rect(ctx, -12, -20, 24, 20, '#4a3524'); ctx.beginPath(); ctx.arc(0, -20, 12, PI, 0); ctx.fillStyle = '#4a3524'; ctx.fill(); for (let i = 0; i < 4; i++) rect(ctx, -9 + i * 5, -24, 1.4, 24, '#6b5238');
  if (o.dorado !== false) rect(ctx, -64, -28, 128, 2, '#f5c04a');
}
function taller(ctx, o) {
  const { c } = o, w = 108, x = -w / 2 - 6, alto = 50;
  sombra(ctx, w / 2 + 14);
  caja(ctx, x, 0, w, alto, 24, o.madera ? '#c9a066' : '#b8c0cc');
  rect(ctx, x, -alto, w, 5, tono(c.techo, 0.95)); cartel(ctx, x + 8, -alto + 8, w - 16, 12, c.acento, o.lavado ? 'gota' : (o.madera ? 'hoja' : 'engranaje'));
  rect(ctx, x + 10, -32, 54, 32, '#5b6675'); for (let k = 1; k < 6; k++) rect(ctx, x + 10, -32 + k * 5.4, 54, 1, 'rgba(0,0,0,0.3)');
  ventana(ctx, x + 72, -30, 26, 18, '#bfe3ff'); if (o.lavado) { for (let i = 0; i < 6; i++) circ(ctx, x + 74 + i * 5, -40 - (i % 2) * 3, 2.2, 'rgba(255,255,255,0.85)'); }
  coche(ctx, x + w + 16, 10, c.acento, 1.4);
  if (o.madera) { for (let i = 0; i < 3; i++) rect(ctx, x + w - 4, -4 - i * 5, 22, 4, '#a9763a'); }
  else { circ(ctx, x + w + 10, -6, 5, '#222'); circ(ctx, x + w + 10, -6, 2, '#999'); circ(ctx, x + w + 10, -15, 5, '#222'); }
}
function santuario(ctx, o) {
  sombra(ctx, 76, 9);
  for (let i = 0; i < 8; i++) { const x = -70 + i * 20, h = 60 + (i % 3) * 16; rect(ctx, x, -h, 5, h, '#58b25a'); rect(ctx, x + 3, -h, 2, h, '#3f8f44'); for (let k = 1; k < 4; k++) rect(ctx, x - 1, -h * k / 4, 7, 2, '#3f8f44'); poli(ctx, [[x + 5, -h + 8], [x + 18, -h + 2], [x + 8, -h + 14]], '#7fd17f'); }
  elip(ctx, 0, -2, 40, 8, '#3a86c9'); elip(ctx, 0, -3, 30, 5, '#6fd0f0');
  const px = 0, py = -34; elip(ctx, px, py + 10, 22, 18, '#fff'); circ(ctx, px, py - 12, 17, '#fff');
  circ(ctx, px - 14, py - 24, 6, '#222'); circ(ctx, px + 14, py - 24, 6, '#222'); elip(ctx, px - 8, py - 12, 5.5, 7, '#222'); elip(ctx, px + 8, py - 12, 5.5, 7, '#222');
  circ(ctx, px - 8, py - 13, 2, '#fff'); circ(ctx, px + 8, py - 13, 2, '#fff'); elip(ctx, px, py - 6, 3.4, 2.4, '#222'); elip(ctx, px - 16, py + 10, 7, 12, '#222'); elip(ctx, px + 16, py + 10, 7, 12, '#222');
  rect(ctx, 34, -26, 3, 26, '#58b25a'); rect(ctx, 44, -30, 3, 30, '#58b25a'); void o;
}

// ---------------- qué dibujo usa cada propiedad ----------------
const TIPOS = { tienda, puesto, restaurante, oficina, torre, hospital, fabrica, tanques, mina, granja, invernadero, puerto, crucero, aeropuerto, deposito, gasolinera, hotel, cabanas, camping, neon, campo, parque, acuatico, zoo, estadio, banco, teatro, mall, isla, espacial, castillo, taller, santuario };

const ASIGNACION = {
  // comida
  tacos: ['puesto', { comida: '#e0a83a' }], cafeteria: ['restaurante', { sim: 'taza' }], nieves: ['puesto', { col: '#ff8fb8', comida: '#ffd1e3' }], elotes: ['puesto', { col: '#f2c14e', comida: '#f7d84a' }],
  hotdogs: ['puesto', { col: '#e5503c', comida: '#c4572f' }], panaderia: ['restaurante', { sim: 'estrella' }], foodtruck: ['deposito', { v: 'foodtruck' }], pizzeria: ['restaurante', { sim: 'pizza' }],
  cantina: ['restaurante', { sim: 'gota' }], hamburguesas: ['restaurante', { sim: 'pelota' }], sushi: ['restaurante', { sim: 'diamante' }], restaurante: ['restaurante', { pisos: 2, sim: 'estrella' }],
  buffet: ['restaurante', { pisos: 2, sim: 'corona' }], pollos: ['restaurante', { pisos: 2, sim: 'corazon' }],
  // comercio
  tiendita: ['tienda', { sim: 'moneda', chico: true }], papeleria: ['tienda', { sim: 'libro' }], floreria: ['tienda', { sim: 'flor', toldo: '#ff7eb6' }], carniceria: ['tienda', { sim: 'corazon', toldo: '#e23b4a' }],
  mascotas: ['tienda', { sim: 'pata' }], ropa: ['tienda', { sim: 'diamante' }], zapateria: ['tienda', { sim: 'rayo' }], ferreteria: ['tienda', { sim: 'engranaje', pisos: 1 }], muebleria: ['tienda', { pisos: 2, sim: 'estrella' }],
  farmacia: ['tienda', { sim: 'cruz', cruz: true, toldo: '#22a06b' }], electronica: ['tienda', { pisos: 2, sim: 'rayo', vidrio: '#8fd0ff' }], joyeria: ['tienda', { sim: 'diamante', toldo: '#7c3aed' }],
  supermercado: ['mall', { chico: true }], plaza: ['mall', {}],
  // servicios
  lavanderia: ['tienda', { sim: 'gota', chico: true }], barberia: ['tienda', { sim: 'estrella', chico: true, toldo: '#e23b4a' }], autolavado: ['taller', { lavado: true }], taller: ['taller', {}],
  guarderia: ['tienda', { sim: 'corazon', toldo: '#ff9ecb', pisos: 1 }], gimnasio: ['neon', { sim: 'engranaje' }], veterinaria: ['tienda', { sim: 'pata' }], escuela: ['oficina', { sim: 'libro', pisos: -1 }],
  spa: ['tienda', { sim: 'flor', toldo: '#b48cff' }], despacho: ['banco', { sim: 'estrella', chico: true }], clinica: ['hospital', {}], notaria: ['banco', { sim: 'libro', chico: true }],
  // diversión
  billar: ['neon', { sim: 'pelota' }], escape: ['neon', { sim: 'llave' }], karaoke: ['neon', { sim: 'nota' }], arcade: ['neon', { sim: 'rayo' }], paintball: ['campo', {}], boliche: ['neon', { sim: 'pelota' }],
  teatro: ['teatro', {}], discoteca: ['neon', { disco: true }], cine: ['teatro', { cine: true }], casino: ['neon', { sim: 'dado', dorado: true }], parquediver: ['parque', {}], estadio: ['estadio', {}],
  // turismo
  camping: ['camping', {}], hostal: ['hotel', { pisos: 2 }], cabanas: ['cabanas', {}], agencia: ['tienda', { sim: 'diamante', toldo: '#2dd4bf' }], museo: ['teatro', { museo: true }], hotel: ['hotel', {}],
  hotelplaya: ['hotel', { playa: true, pisos: 4 }], acuatico: ['acuatico', {}], zoologico: ['zoo', {}], crucero: ['crucero', {}],
  // industria
  carpinteria: ['taller', { madera: true }], invernadero: ['invernadero', {}], granja: ['granja', {}], ladrillera: ['fabrica', { ladrillo: true }], pesquera: ['puerto', { pesca: true }], textil: ['fabrica', {}],
  embotelladora: ['fabrica', { tanque: true }], mina: ['mina', {}], acereria: ['fabrica', { horno: true }], refineria: ['tanques', {}],
  // tecnología
  cibercafe: ['tienda', { sim: 'rayo', vidrio: '#8fd0ff', chico: true }], celulares: ['tienda', { sim: 'rayo', chico: true, vidrio: '#8fd0ff' }], apps: ['oficina', { sim: 'estrella' }], hosting: ['oficina', { server: true, sim: 'engranaje' }],
  ciberseguridad: ['oficina', { sim: 'diamante' }], videojuegos: ['oficina', { sim: 'dado', pisos: 1 }], streaming: ['torre', { antena: true }], robotica: ['oficina', { sim: 'engranaje', pisos: 2 }], ia: ['oficina', { domo: true, pisos: 2 }],
  satelites: ['espacial', { satelite: true }],
  // transporte
  bicitaxis: ['deposito', { v: 'bici' }], taxis: ['deposito', { v: 'taxi' }], camiones: ['deposito', { v: 'camion' }], gasolinera: ['gasolinera', {}], paqueteria: ['deposito', { v: 'van' }], autobuses: ['deposito', { v: 'bus' }],
  tren: ['deposito', { v: 'tren' }], puerto: ['puerto', {}], aerolinea: ['aeropuerto', { chico: true }],
  // finanzas
  empeno: ['banco', { sim: 'moneda', chico: true }], cambio: ['banco', { sim: 'moneda', chico: true }], inmobiliaria: ['oficina', { sim: 'llave' }], seguros: ['oficina', { sim: 'diamante', pisos: 1 }], cripto: ['oficina', { sim: 'moneda', pisos: 2 }],
  bancolocal: ['banco', {}], bolsa: ['banco', { bolsa: true }], holding: ['torre', { cluster: 3 }],
  // gran capital
  isla: ['isla', {}], rascacielos: ['torre', { cluster: 1 }], megamall: ['mall', { mega: true }], aeropuerto: ['aeropuerto', {}], puertomundial: ['puerto', { mundial: true }], espacial: ['espacial', {}], ciudad: ['torre', { cluster: 5 }], conglomerado: ['torre', { cluster: 3 }],
  // exclusivas
  jugueteria: ['tienda', { pisos: 2, sim: 'estrella', toldo: '#ff6fa8', dorado: true }], tiendabarrio: ['tienda', { sim: 'corazon', dorado: true }], fondalegendaria: ['restaurante', { pisos: 2, dorado: true, sim: 'estrella' }],
  cinedeluxe: ['teatro', { cine: true, dorado: true }], hotelmirador: ['hotel', { dorado: true, pisos: 6 }], casinodorado: ['neon', { sim: 'dado', dorado: true }], clubfutbol: ['estadio', { futbol: true }],
  santuariopanda: ['santuario', {}], castillo: ['castillo', {}], minadiamantes: ['mina', { diamantes: true }], pozopetrolero: ['tanques', { pozo: true }], cohetes: ['espacial', { cohete: true }]
};

const PAREDES = ['#f3dcb8', '#efc4b0', '#d4e6f3', '#dcebc8', '#f0dff2', '#f8e9a9', '#cfd9e2', '#f6cfd0'];
const TECHOS = ['#b4503a', '#5d78a6', '#3f8d66', '#8a5cc0', '#c97b34', '#2f7da0', '#a8344f'];

// ---------------- iconos extra (siluetas blancas que van dentro del medallón) ----------------
function simbolo2(ctx, tipo, x, y, r, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.6, r * 0.2); ctx.lineCap = 'round';
  const R = (a, b, w, h) => ctx.fillRect(x + a * r, y + b * r, w * r, h * r);
  const P = (pts) => poli(ctx, pts.map(([a, b]) => [x + a * r, y + b * r]), col);
  const L = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(x + a * r, y + b * r); ctx.lineTo(x + c * r, y + d * r); ctx.stroke(); };
  const C = (a, b, rad) => circ(ctx, x + a * r, y + b * r, rad * r, col);
  const RR = (a, b, w, h, rad) => rrect(ctx, x + a * r, y + b * r, w * r, h * r, rad * r, col);
  const sombra_ = 'rgba(0,0,0,0.32)';
  switch (tipo) {
    case 'burger': ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.95, PI, 0); ctx.closePath(); ctx.fill(); R(-0.95, 0.0, 1.9, 0.22); R(-0.95, 0.35, 1.9, 0.18); RR(-0.95, 0.65, 1.9, 0.32, 0.15); break;
    case 'helado': P([[-0.6, -0.1], [0.6, -0.1], [0, 1]]); C(0, -0.4, 0.62); C(-0.35, -0.75, 0.32); break;
    case 'taco': ctx.beginPath(); ctx.arc(x, y + r * 0.5, r, PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = sombra_; ctx.beginPath(); ctx.arc(x, y + r * 0.5, r * 0.55, PI, 0); ctx.closePath(); ctx.fill(); break;
    case 'maiz': ctx.beginPath(); ctx.ellipse(x, y - r * 0.1, r * 0.45, r * 0.9, 0.3, 0, PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r); ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.2, x - r * 0.3, y - r * 0.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + r * 0.2, y + r); ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.3, x + r * 0.5, y - r * 0.2); ctx.stroke(); break;
    case 'hotdog': ctx.save(); ctx.translate(x, y); ctx.rotate(-0.45); ctx.fillStyle = col; rrect(ctx, -r, -r * 0.4, r * 2, r * 0.8, r * 0.4, col); ctx.fillStyle = sombra_; rrect(ctx, -r * 0.85, -r * 0.12, r * 1.7, r * 0.24, r * 0.12, sombra_); ctx.restore(); break;
    case 'pan': RR(-1, -0.4, 2, 0.95, 0.47); ctx.strokeStyle = sombra_; ctx.lineWidth = r * 0.15; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + (i * 0.5 - 0.12) * r, y - r * 0.22); ctx.lineTo(x + (i * 0.5 + 0.12) * r, y + r * 0.3); ctx.stroke(); } break;
    case 'cerveza': R(-0.75, -0.45, 1.25, 1.4); ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.2, r * 0.38, -PI / 2, PI / 2); ctx.stroke(); C(-0.5, -0.55, 0.32); C(-0.05, -0.7, 0.36); C(0.35, -0.55, 0.3); break;
    case 'sushi': RR(-1, 0.05, 2, 0.75, 0.3); RR(-0.85, -0.6, 1.7, 0.6, 0.3); ctx.fillStyle = sombra_; ctx.fillRect(x - r * 0.15, y - r * 0.6, r * 0.3, r * 1.4); break;
    case 'pollo': C(-0.3, -0.3, 0.75); L(0.1, 0.1, 0.8, 0.8); C(0.85, 0.65, 0.2); C(0.65, 0.88, 0.2); break;
    case 'cubiertos': R(-0.7, -0.9, 0.12, 0.6); R(-0.45, -0.9, 0.12, 0.6); R(-0.2, -0.9, 0.12, 0.6); R(-0.7, -0.4, 0.62, 0.2); R(-0.5, -0.3, 0.2, 1.2); P([[0.45, -0.9], [0.8, -0.8], [0.8, 0.1], [0.45, 0.1]]); R(0.55, 0.1, 0.2, 0.8); break;
    case 'camisa': P([[-0.5, -0.9], [-1, -0.4], [-0.7, -0.05], [-0.5, -0.2], [-0.5, 0.9], [0.5, 0.9], [0.5, -0.2], [0.7, -0.05], [1, -0.4], [0.5, -0.9], [0.2, -0.7], [-0.2, -0.7]]); break;
    case 'zapato': P([[-1, 0.7], [-1, -0.1], [-0.2, -0.2], [0.2, -0.8], [0.55, -0.8], [0.55, -0.1], [1, 0.2], [1, 0.7]]); break;
    case 'martillo': ctx.save(); ctx.translate(x, y); ctx.rotate(0.7); ctx.fillStyle = col; ctx.fillRect(-0.15 * r, -0.3 * r, 0.3 * r, 1.3 * r); ctx.fillRect(-0.75 * r, -0.85 * r, 1.5 * r, 0.55 * r); ctx.restore(); break;
    case 'sofa': RR(-1, -0.15, 2, 0.8, 0.2); RR(-0.8, -0.85, 1.6, 0.75, 0.2); RR(-1, -0.45, 0.35, 0.95, 0.15); RR(0.65, -0.45, 0.35, 0.95, 0.15); R(-0.8, 0.65, 0.15, 0.25); R(0.65, 0.65, 0.15, 0.25); break;
    case 'monitor': RR(-1, -0.8, 2, 1.3, 0.15); R(-0.12, 0.5, 0.24, 0.3); R(-0.5, 0.78, 1, 0.15); break;
    case 'carrito': P([[-1, -0.55], [0.95, -0.55], [0.6, 0.25], [-0.6, 0.25]]); L(-1, -0.55, -1.25, -0.9); C(-0.4, 0.65, 0.2); C(0.45, 0.65, 0.2); break;
    case 'bolsa': P([[-0.8, -0.45], [0.8, -0.45], [0.9, 0.95], [-0.9, 0.95]]); ctx.beginPath(); ctx.arc(x, y - r * 0.45, r * 0.4, PI, 0); ctx.stroke(); break;
    case 'tijera': L(-0.6, 0.8, 0.7, -0.9); L(0.6, 0.8, -0.7, -0.9); ctx.beginPath(); ctx.arc(x - r * 0.5, y + r * 0.62, r * 0.3, 0, PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x + r * 0.5, y + r * 0.62, r * 0.3, 0, PI * 2); ctx.stroke(); break;
    case 'llave_inglesa': ctx.save(); ctx.translate(x, y); ctx.rotate(-0.8); ctx.fillStyle = col; ctx.fillRect(-0.2 * r, -0.1 * r, 0.4 * r, 1.1 * r); circ(ctx, 0, -0.45 * r, 0.55 * r, col); ctx.fillStyle = sombra_; ctx.fillRect(-0.18 * r, -1.05 * r, 0.36 * r, 0.6 * r); ctx.restore(); break;
    case 'pesa': R(-0.7, -0.12, 1.4, 0.24); R(-1, -0.55, 0.3, 1.1); R(0.7, -0.55, 0.3, 1.1); R(-0.7, -0.4, 0.2, 0.8); R(0.5, -0.4, 0.2, 0.8); break;
    case 'control': RR(-1, -0.5, 2, 1.1, 0.45); ctx.fillStyle = sombra_; ctx.fillRect(x - r * 0.65, y - r * 0.1, r * 0.5, r * 0.16); ctx.fillRect(x - r * 0.48, y - r * 0.27, r * 0.16, r * 0.5); circ(ctx, x + r * 0.45, y - r * 0.05, r * 0.12, sombra_); circ(ctx, x + r * 0.7, y + r * 0.12, r * 0.12, sombra_); break;
    case 'claqueta': R(-0.95, -0.2, 1.9, 1.05); P([[-0.95, -0.3], [0.9, -0.85], [0.95, -0.55], [-0.9, 0.0]]); ctx.fillStyle = sombra_; for (let i = 0; i < 4; i++) ctx.fillRect(x + (-0.7 + i * 0.5) * r, y + (-0.3 - i * 0.13) * r, 0.2 * r, 0.18 * r); break;
    case 'tienda': P([[-1, 0.8], [0, -0.9], [1, 0.8]]); ctx.fillStyle = sombra_; ctx.beginPath(); ctx.moveTo(x - r * 0.25, y + r * 0.8); ctx.lineTo(x, y - r * 0.1); ctx.lineTo(x + r * 0.25, y + r * 0.8); ctx.fill(); break;
    case 'cama': R(-1, 0.05, 2, 0.5); R(-1, -0.55, 0.25, 1.3); RR(-0.7, -0.3, 0.7, 0.3, 0.12); R(0.8, 0.55, 0.2, 0.3); break;
    case 'maleta': RR(-0.9, -0.5, 1.8, 1.3, 0.2); ctx.beginPath(); ctx.rect(x - r * 0.35, y - r * 0.85, r * 0.7, r * 0.38); ctx.stroke(); break;
    case 'palmera': ctx.beginPath(); ctx.moveTo(x - r * 0.1, y + r); ctx.quadraticCurveTo(x + r * 0.3, y, x + r * 0.05, y - r * 0.5); ctx.stroke(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i - 2) * 0.6; ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 0.5); ctx.quadraticCurveTo(x + Math.cos(a) * r * 0.7, y - r * 0.5 + Math.sin(a) * r * 0.5 - r * 0.2, x + Math.cos(a) * r * 1.0, y - r * 0.4 + Math.sin(a) * r * 0.2 + r * 0.25); ctx.stroke(); } break;
    case 'barco': P([[-1, 0.1], [1, 0.1], [0.6, 0.7], [-0.6, 0.7]]); R(-0.4, -0.35, 0.8, 0.4); R(-0.2, -0.75, 0.4, 0.4); L(0.5, 0.1, 0.5, -0.8); break;
    case 'pez': ctx.beginPath(); ctx.ellipse(x - r * 0.1, y, r * 0.8, r * 0.5, 0, 0, PI * 2); ctx.fill(); P([[0.6, 0], [1.1, -0.45], [1.1, 0.45]]); break;
    case 'pico': L(-0.8, 0.9, 0.4, -0.6); ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.8, -PI * 0.95, -PI * 0.1); ctx.stroke(); break;
    case 'chip': RR(-0.6, -0.6, 1.2, 1.2, 0.12); for (let i = -1; i <= 1; i++) { R(i * 0.4 - 0.06, -0.95, 0.12, 0.3); R(i * 0.4 - 0.06, 0.65, 0.12, 0.3); R(-0.95, i * 0.4 - 0.06, 0.3, 0.12); R(0.65, i * 0.4 - 0.06, 0.3, 0.12); } break;
    case 'nube': C(-0.45, 0.1, 0.45); C(0.1, -0.2, 0.55); C(0.55, 0.15, 0.4); R(-0.45, 0.1, 1.0, 0.45); break;
    case 'candado': RR(-0.7, -0.1, 1.4, 1.0, 0.15); ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.45, PI, 0); ctx.lineTo(x + r * 0.45, y + r * 0.1); ctx.moveTo(x - r * 0.45, y - r * 0.1); ctx.lineTo(x - r * 0.45, y + r * 0.1); ctx.stroke(); break;
    case 'bici': ctx.beginPath(); ctx.arc(x - r * 0.55, y + r * 0.35, r * 0.45, 0, PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x + r * 0.6, y + r * 0.35, r * 0.45, 0, PI * 2); ctx.stroke(); L(-0.55, 0.35, -0.1, -0.35); L(-0.1, -0.35, 0.6, 0.35); L(-0.1, -0.35, 0.45, -0.35); L(-0.55, 0.35, 0.15, 0.35); break;
    case 'taxi': RR(-1, 0.0, 2, 0.6, 0.2); RR(-0.55, -0.55, 1.1, 0.6, 0.2); R(-0.2, -0.85, 0.4, 0.3); C(-0.55, 0.62, 0.22); C(0.55, 0.62, 0.22); break;
    case 'camion': R(-1, -0.6, 1.2, 1.1); P([[0.3, -0.25], [0.7, -0.25], [1, 0.1], [1, 0.5], [0.3, 0.5]]); C(-0.55, 0.62, 0.24); C(0.55, 0.62, 0.24); break;
    case 'bus': RR(-1, -0.65, 2, 1.25, 0.25); ctx.fillStyle = sombra_; for (let i = 0; i < 3; i++) ctx.fillRect(x + (-0.8 + i * 0.58) * r, y - r * 0.45, r * 0.45, r * 0.4); C(-0.55, 0.65, 0.22); C(0.55, 0.65, 0.22); break;
    case 'tren': RR(-1, -0.3, 1.4, 0.9, 0.15); P([[0.4, -0.3], [0.85, -0.3], [1, 0.6], [0.4, 0.6]]); R(-0.7, -0.75, 0.3, 0.45); C(-0.6, 0.72, 0.2); C(0.0, 0.72, 0.2); C(0.65, 0.72, 0.2); break;
    case 'surtidor': RR(-0.55, -0.9, 1.1, 1.8, 0.12); ctx.fillStyle = sombra_; ctx.fillRect(x - r * 0.35, y - r * 0.7, r * 0.7, r * 0.5); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 0.4); ctx.lineTo(x + r * 0.9, y - r * 0.1); ctx.lineTo(x + r * 0.9, y + r * 0.6); ctx.stroke(); break;
    case 'avion': P([[-1, 0.1], [0.7, -0.15], [1, 0], [0.7, 0.15]]); P([[-0.1, 0], [0.2, -0.95], [0.45, -0.95], [0.35, 0]]); P([[-0.1, 0], [0.2, 0.95], [0.45, 0.95], [0.35, 0]]); P([[-1, 0.1], [-0.75, -0.4], [-0.55, -0.4], [-0.5, 0.1]]); break;
    case 'ancla': ctx.beginPath(); ctx.arc(x, y - r * 0.7, r * 0.22, 0, PI * 2); ctx.stroke(); L(0, -0.5, 0, 0.9); L(-0.45, -0.1, 0.45, -0.1); ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.85, 0.15 * PI, 0.85 * PI); ctx.stroke(); break;
    case 'cohete': ctx.beginPath(); ctx.ellipse(x, y - r * 0.1, r * 0.4, r * 0.85, 0, 0, PI * 2); ctx.fill(); P([[-0.38, 0.35], [-0.85, 0.85], [-0.3, 0.6]]); P([[0.38, 0.35], [0.85, 0.85], [0.3, 0.6]]); circ(ctx, x, y - r * 0.25, r * 0.17, sombra_); break;
    case 'satelite': ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6); ctx.fillStyle = col; ctx.fillRect(-0.3 * r, -0.3 * r, 0.6 * r, 0.6 * r); ctx.fillRect(-1 * r, -0.2 * r, 0.6 * r, 0.4 * r); ctx.fillRect(0.4 * r, -0.2 * r, 0.6 * r, 0.4 * r); ctx.restore(); break;
    case 'casa': P([[-1, -0.1], [0, -0.95], [1, -0.1]]); R(-0.7, -0.1, 1.4, 1.0); ctx.fillStyle = sombra_; ctx.fillRect(x - r * 0.18, y + r * 0.35, r * 0.36, r * 0.55); break;
    case 'grafica': R(-0.9, 0.2, 0.4, 0.7); R(-0.3, -0.2, 0.4, 1.1); R(0.3, -0.6, 0.4, 1.5); ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.2); ctx.lineTo(x - r * 0.1, y - r * 0.7); ctx.lineTo(x + r * 0.4, y - r * 0.5); ctx.lineTo(x + r, y - r * 0.95); ctx.stroke(); break;
    case 'regalo': R(-0.85, -0.2, 1.7, 1.1); R(-1, -0.55, 2, 0.4); ctx.fillStyle = sombra_; ctx.fillRect(x - r * 0.14, y - r * 0.55, r * 0.28, r * 1.45); C(-0.3, -0.8, 0.28); C(0.3, -0.8, 0.28); break;
    case 'castillo': R(-0.9, -0.2, 1.8, 1.1); R(-0.9, -0.55, 0.4, 0.4); R(-0.2, -0.55, 0.4, 0.4); R(0.5, -0.55, 0.4, 0.4); R(-0.9, -0.9, 0.4, 0.5); R(0.5, -0.9, 0.4, 0.5); ctx.fillStyle = sombra_; ctx.beginPath(); ctx.arc(x, y + r * 0.6, r * 0.3, PI, 0); ctx.lineTo(x + r * 0.3, y + r * 0.9); ctx.lineTo(x - r * 0.3, y + r * 0.9); ctx.fill(); break;
    case 'balanza': L(0, -0.85, 0, 0.8); L(-0.9, -0.5, 0.9, -0.5); P([[-1.1, 0.1], [-0.4, 0.1], [-0.75, -0.35]]); P([[0.4, 0.1], [1.1, 0.1], [0.75, -0.35]]); R(-0.5, 0.8, 1, 0.14); break;
    case 'columna': R(-0.9, 0.7, 1.8, 0.2); R(-0.7, -0.5, 0.25, 1.2); R(-0.15, -0.5, 0.25, 1.2); R(0.45, -0.5, 0.25, 1.2); P([[-1, -0.55], [0, -1], [1, -0.55]]); break;
    default: circ(ctx, x, y, r * 0.8, col);
  }
  ctx.lineCap = 'butt';
}

// Icono grande de cada propiedad (el que flota sobre el edificio)
const ICONO = {
  tacos: 'taco', cafeteria: 'taza', nieves: 'helado', elotes: 'maiz', hotdogs: 'hotdog', panaderia: 'pan', foodtruck: 'camion', pizzeria: 'pizza', cantina: 'cerveza', hamburguesas: 'burger', sushi: 'sushi', restaurante: 'cubiertos', buffet: 'cubiertos', pollos: 'pollo',
  tiendita: 'bolsa', papeleria: 'libro', floreria: 'flor', carniceria: 'pollo', mascotas: 'pata', ropa: 'camisa', zapateria: 'zapato', ferreteria: 'martillo', muebleria: 'sofa', farmacia: 'cruz', electronica: 'monitor', joyeria: 'diamante', supermercado: 'carrito', plaza: 'bolsa',
  lavanderia: 'gota', barberia: 'tijera', autolavado: 'gota', taller: 'llave_inglesa', guarderia: 'corazon', gimnasio: 'pesa', veterinaria: 'pata', escuela: 'libro', spa: 'flor', despacho: 'balanza', clinica: 'cruz', notaria: 'libro',
  billar: 'pelota', escape: 'llave', karaoke: 'nota', arcade: 'control', paintball: 'pelota', boliche: 'pelota', teatro: 'estrella', discoteca: 'nota', cine: 'claqueta', casino: 'dado', parquediver: 'estrella', estadio: 'pelota',
  camping: 'tienda', hostal: 'cama', cabanas: 'casa', agencia: 'maleta', museo: 'columna', hotel: 'cama', hotelplaya: 'palmera', acuatico: 'gota', zoologico: 'pata', crucero: 'barco',
  carpinteria: 'martillo', invernadero: 'hoja', granja: 'casa', ladrillera: 'engranaje', pesquera: 'pez', textil: 'camisa', embotelladora: 'gota', mina: 'pico', acereria: 'engranaje', refineria: 'gota',
  cibercafe: 'monitor', celulares: 'rayo', apps: 'chip', hosting: 'nube', ciberseguridad: 'candado', videojuegos: 'control', streaming: 'monitor', robotica: 'engranaje', ia: 'chip', satelites: 'satelite',
  bicitaxis: 'bici', taxis: 'taxi', camiones: 'camion', gasolinera: 'surtidor', paqueteria: 'bolsa', autobuses: 'bus', tren: 'tren', puerto: 'ancla', aerolinea: 'avion',
  empeno: 'moneda', cambio: 'moneda', inmobiliaria: 'casa', seguros: 'candado', cripto: 'moneda', bancolocal: 'moneda', bolsa: 'grafica', holding: 'grafica',
  isla: 'palmera', rascacielos: 'estrella', megamall: 'bolsa', aeropuerto: 'avion', puertomundial: 'ancla', espacial: 'cohete', ciudad: 'estrella', conglomerado: 'grafica',
  jugueteria: 'regalo', tiendabarrio: 'corazon', fondalegendaria: 'cubiertos', cinedeluxe: 'claqueta', hotelmirador: 'cama', casinodorado: 'dado', clubfutbol: 'pelota', santuariopanda: 'pata', castillo: 'castillo', minadiamantes: 'diamante', pozopetrolero: 'gota', cohetes: 'cohete'
};

// Alto aproximado del dibujo (para poner el icono justo encima)
function altura(tipo, o) {
  const n = o.n || 0, p = o.pisos || 0;
  switch (tipo) {
    case 'puesto': return 70;
    case 'tienda': return 62 + (Math.max(1, p) - 1) * 34;
    case 'restaurante': return 66 + (Math.max(1, p) - 1) * 30 + 14;
    case 'oficina': return (4 + n + p) * 17 + 16;
    case 'torre': return ((o.cluster === 1 || !o.cluster ? 7 : 8) + n) * 15 + 24 + (o.antena ? 20 : 0);
    case 'hospital': return 78;
    case 'fabrica': return 96;
    case 'tanques': return o.pozo ? 96 : 112;
    case 'mina': return 92;
    case 'granja': return 70;
    case 'invernadero': return 58;
    case 'puerto': return o.pesca ? 54 : 78;
    case 'crucero': return 74;
    case 'aeropuerto': return o.chico ? 60 : 84;
    case 'deposito': return 62;
    case 'gasolinera': return 80;
    case 'hotel': return ((o.pisos || 5) + (o.pisos ? 0 : n)) * 17 + 28;
    case 'cabanas': return 56;
    case 'camping': return 46;
    case 'neon': return 66;
    case 'campo': return 44;
    case 'parque': return 96;
    case 'acuatico': return 72;
    case 'zoo': return 76;
    case 'estadio': return 66;
    case 'banco': return 84;
    case 'teatro': return o.museo ? 94 : 68;
    case 'mall': return 86;
    case 'isla': return 56;
    case 'espacial': return o.satelite ? 82 : 120;
    case 'castillo': return 124;
    case 'taller': return 56;
    case 'santuario': return 84;
    default: return 70;
  }
}

// ---------------- gris (comercios que todavía no tienes) ----------------
function gris(c) {
  let r, g, b, a = 1;
  if (c[0] === '#') {
    let h = c.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16); if (Number.isNaN(n)) return c;
    r = n >> 16; g = (n >> 8) & 255; b = n & 255;
  } else if (c.startsWith('rgb')) { const m = c.match(/[\d.]+/g); if (!m || m.length < 3) return c; r = +m[0]; g = +m[1]; b = +m[2]; if (m.length > 3) a = +m[3]; }
  else return c;
  const l = 0.3 * r + 0.59 * g + 0.11 * b, v = Math.round(78 + l * 0.6);
  return a < 1 ? `rgba(${v},${v},${v},${a})` : `rgb(${v},${v},${v})`;
}
function ctxGris(ctx) {
  return new Proxy(ctx, {
    get(t, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; },
    set(t, k, v) { t[k] = (k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string' ? gris(v) : v; return true; }
  });
}

function preparar(d) {
  const [tipo, opciones] = ASIGNACION[d.id] || ['tienda', {}];
  const r = rng(hash(d.id || d.nombre));
  const c = { pared: PAREDES[Math.floor(r() * PAREDES.length)], techo: TECHOS[Math.floor(r() * TECHOS.length)], acento: d.color || '#3cb4f0' };
  const o = { ...opciones, c, n: Math.max(0, Number(d.nivel) || 0), r };
  if (o.pisos === -1) o.pisos = 0;
  return { tipo, o };
}

// Solo el edificio. d: { id, color, nivel, gris }
function dibujar(ctx, d, cx, suelo, escala = 1) {
  const { tipo, o } = preparar(d);
  const g = d.gris ? ctxGris(ctx) : ctx;
  g.save(); g.translate(cx, suelo); g.scale(escala, escala);
  (TIPOS[tipo] || tienda)(g, o);
  g.restore();
}

function medallon(ctx, sim, cx, cy, r, color, dorado) {
  elip(ctx, cx + 1, cy + r + 5, r * 0.8, r * 0.22, 'rgba(0,0,0,0.20)');
  circ(ctx, cx, cy, r + 3.5, dorado ? '#f5c04a' : '#ffffff');
  circ(ctx, cx, cy, r, tono(color, 0.92));
  ctx.beginPath(); ctx.arc(cx, cy, r, PI * 1.05, PI * 1.75); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
  simbolo(ctx, sim, cx, cy + 0.5, r * 0.56, '#ffffff');
  if (dorado) simbolo(ctx, 'corona', cx, cy - r - 12, 8, '#f5c04a');
}

function placa(ctx, texto, cx, y, d) {
  ctx.font = `bold 15px ${FUENTE}`; ctx.textAlign = 'left';
  const pips = d.gris ? 0 : Math.min(4, d.maxNivel || 0), anchoPips = pips ? pips * 11 + 4 : 0;
  let t = String(texto || '');
  const max = 196 - anchoPips - 20;
  if (ctx.measureText(t).width > max) { while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1); t = t.trimEnd() + '…'; }
  const tw = ctx.measureText(t).width, w = tw + 20 + anchoPips, x = cx - w / 2;
  rrect(ctx, x + 1, y + 2, w, 23, 8, 'rgba(0,0,0,0.22)');
  rrect(ctx, x, y, w, 23, 8, d.exclusiva ? '#f5c04a' : '#6b4a2f');
  rrect(ctx, x + 1.6, y + 1.6, w - 3.2, 19.8, 7, '#fff6e0');
  ctx.fillStyle = '#3b2a1a'; ctx.fillText(t, x + 10, y + 16.5);
  for (let i = 0; i < pips; i++) simbolo(ctx, 'estrella', x + 10 + tw + 9 + i * 11, y + 11.5, 4.6, i < (d.nivel || 0) ? '#f0b323' : '#cfc3a6');
  if (d.pareja) simbolo(ctx, 'corazon', x - 4, y - 3, 6, '#ff6fa8');
}

// Comercio completo: edificio + icono grande + placa con el nombre. (cx, suelo) = centro del suelo del edificio.
function comercio(ctx, d, cx, suelo, escala = 1) {
  const { tipo, o } = preparar(d);
  const g = d.gris ? ctxGris(ctx) : ctx;
  dibujar(ctx, d, cx, suelo, escala);
  const alto = altura(tipo, o) * escala, r = 23 * escala;
  medallon(g, ICONO[d.id] || 'estrella', cx, suelo - alto - r - 8, r, d.color || '#3cb4f0', !!d.exclusiva);
  placa(g, d.nombre, cx, suelo + 10, d);
}

const API = { dibujar, comercio, medallon, placa, altura, preparar, gris, ctxGris, ASIGNACION, ICONO, TIPOS, simbolo, arbol, palmera, coche, tono, alfa, rrect, rng, hash, circ, elip, poli, rect, linea, caja, FUENTE };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MapaEdificios = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

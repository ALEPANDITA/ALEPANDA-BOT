// El MUNDO del .mapa: una ciudad ilustrada con zonas (desierto, nieve, roca, pradera, playa), ríos con puentes, caminos,
// árboles y los 119 comercios, cada uno SIEMPRE en el mismo lugar. Los que no tienes se ven en gris.
// Este archivo funciona igual en Node (imágenes del .mapa 1-4) y dentro del HTML del panel (lo dibuja el celular).
// Solo usa la API normal de canvas: quien lo use le pasa { crearLienzo(ancho, alto) }.

(function (root) {
'use strict';
const E = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./mapa-edificios') : root.MapaEdificios;
const PI = Math.PI;

// ---------------- medidas ----------------
const CELDA_W = 208, CELDA_H = 218, COLS = 7, FILAS = 7; // PARCHE-MAPA-ELITE (antes 5 filas)
const MO = 130, MN = 130, CRUCE = 150, ME = 300, MS = 300;
const QW = COLS * CELDA_W, QH = FILAS * CELDA_H;
const ANCHO = MO + QW + CRUCE + QW + ME;
const ALTO = MN + QH + CRUCE + QH + MS;
const CX = MO + QW + CRUCE / 2, CY = MN + QH + CRUCE / 2; // centro del cruce de los dos ríos
const ORIGENES = [[MO, MN], [MO + QW + CRUCE, MN], [MO, MN + QH + CRUCE], [MO + QW + CRUCE, MN + QH + CRUCE]];
// Qué categorías van en cada cuarto del mapa (arriba-izq, arriba-der, abajo-izq, abajo-der)
const CUADRANTES = [['comercio', 'diversion', 'capital'], ['tecnologia', 'finanzas', 'exclusivas', 'elite'], ['industria', 'transporte', 'servicios', 'elite'], ['comida', 'turismo', 'elite']];
const NOMBRE_CUADRANTE = ['Desierto', 'Montañas nevadas', 'Puerto y minas', 'Pradera y playa'];
// Las 4 partes de .mapa 1-4: [x, y, ancho, alto] (cortan justo por el cruce de los ríos, donde no hay comercios)
const PARTES = [[0, 0, CX, CY], [CX, 0, ANCHO - CX, CY], [0, CY, CX, ALTO - CY], [CX, CY, ANCHO - CX, ALTO - CY]];

// ---------------- ruido ----------------
function h2(ix, iy, s) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, y, s = 1) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 1) => ruido(x, y, s) * 0.55 + ruido(x * 2.1, y * 2.1, s + 7) * 0.3 + ruido(x * 4.3, y * 4.3, s + 13) * 0.15;
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mezcla = (c1, c2, t) => [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
const hexA = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbS = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

// ---------------- biomas ----------------
const COL = {
  pasto: [hexA('#7ccd52'), hexA('#62b546')], desierto: [hexA('#f1d28a'), hexA('#e2b866')], roca: [hexA('#b88e5c'), hexA('#9c7449')],
  nieve: [hexA('#f6f9fd'), hexA('#d3e3f1')], arena: hexA('#f7e5ad'),
  somero: hexA('#62d9e4'), medio: hexA('#2fa8d9'), hondo: hexA('#1f78bd')
};
const costaE = (Y) => ANCHO - ME + 120 + (fbm(Y / 260, 3.1, 5) - 0.5) * 120;
const costaS = (X) => ALTO - MS + 120 + (fbm(X / 260, 7.7, 9) - 0.5) * 120;
const distMar = (X, Y) => Math.max(X - costaE(Y), Y - costaS(X)); // > 0 = adentro del mar

function pesos(X, Y) {
  const wx = suave(CX - 300, CX + 300, X + (fbm(X / 500, Y / 500, 11) - 0.5) * 240), wy = suave(CY - 300, CY + 300, Y + (fbm(X / 500 + 9, Y / 500 + 3, 12) - 0.5) * 240);
  const gc = Math.exp(-(((X - CX) ** 2) + ((Y - CY) ** 2)) / (2 * 430 * 430));
  const w = { d: (1 - wx) * (1 - wy), n: wx * (1 - wy), r: (1 - wx) * wy, p: wx * wy + gc * 1.8 };
  const t = w.d + w.n + w.r + w.p;
  return { d: w.d / t, n: w.n / t, r: w.r / t, p: w.p / t };
}
function colorTerreno(X, Y) {
  const dm = distMar(X, Y);
  if (dm > 0) {
    const t = Math.min(1, dm / 190), ond = fbm(X / 70, Y / 70, 21);
    let c = t < 0.35 ? mezcla(COL.somero, COL.medio, t / 0.35) : mezcla(COL.medio, COL.hondo, (t - 0.35) / 0.65);
    return mezcla(c, [255, 255, 255], Math.max(0, ond - 0.62) * 0.9);
  }
  const w = pesos(X, Y), n1 = fbm(X / 110, Y / 110, 3), n2 = fbm(X / 34, Y / 34, 4);
  const par = (b) => mezcla(b[0], b[1], Math.min(1, n1 * 0.8 + n2 * 0.4));
  let c = [0, 0, 0];
  for (const [k, b] of [['d', COL.desierto], ['n', COL.nieve], ['r', COL.roca], ['p', COL.pasto]]) { const v = par(b); c = [c[0] + v[0] * w[k], c[1] + v[1] * w[k], c[2] + v[2] * w[k]]; }
  if (dm > -52) c = mezcla(c, COL.arena, Math.min(1, (52 + dm) / 52) * (0.55 + n2 * 0.45)); // playa
  return c;
}
function biomaDe(X, Y) { const w = pesos(X, Y); let k = 'p', m = w.p; for (const q of ['d', 'n', 'r']) if (w[q] > m) { k = q; m = w[q]; } return k; }

// ---------------- colocación de los comercios ----------------
function colocar(items) {
  const porCat = {};
  for (const it of items) (porCat[it.cat] = porCat[it.cat] || []).push(it);
  for (const k of Object.keys(porCat)) porCat[k].sort((a, b) => a.num - b.num);
  const lotes = [];
  // la Élite Mundial se reparte en los espacios libres: primero la pradera y la playa, luego el puerto y por último las montañas
  const base = CUADRANTES.map((cats) => cats.filter((c) => c !== 'elite').flatMap((c) => porCat[c] || []));
  const elite = porCat.elite || [];
  for (const q of [3, 2, 1, 0]) base[q].push(...elite.splice(0, Math.max(0, COLS * FILAS - base[q].length)));
  CUADRANTES.forEach((cats, q) => {
    const [ox, oy] = ORIGENES[q];
    base[q].forEach((it, k) => {
      const fila = Math.floor(k / COLS); let col = k % COLS; if (fila % 2) col = COLS - 1 - col; // serpiente: la calle va y viene
      const r = E.rng(E.hash(it.id));
      lotes.push({ id: it.id, cat: it.cat, q, k, fila, col, x: ox + col * CELDA_W + CELDA_W / 2 + (r() - 0.5) * 26, y: oy + fila * CELDA_H + 160 + (r() - 0.5) * 14 });
    });
  });
  return lotes;
}

// ---------------- ríos y caminos ----------------
function rioVertical() {
  const pts = [];
  for (let y = -60; y <= ALTO + 60; y += 50) pts.push([CX + 24 * Math.sin(y / 230) + (fbm(y / 300, 2.2, 31) - 0.5) * 36, y]);
  return { pts, ancho: (i) => 58 + 22 * (pts[i][1] / ALTO) };
}
function rioHorizontal() {
  const pts = [];
  for (let x = -60; x <= CX; x += 50) pts.push([x, CY + 20 * Math.sin(x / 260) + (fbm(x / 300, 4.4, 33) - 0.5) * 30]);
  pts.push([CX, CY]);
  return { pts, ancho: () => 54 };
}
function rioEste() {
  const pts = [[CX, CY]];
  for (let x = CX + 50; x <= costaE(CY) + 30; x += 50) pts.push([x, CY + 18 * Math.sin(x / 240) + (fbm(x / 300, 5.5, 35) - 0.5) * 26]);
  return { pts, ancho: () => 54 };
}
function caminoCuadrante(q, n) {
  const [ox, oy] = ORIGENES[q], pts = [];
  const filas = Math.ceil(n / COLS);
  for (let f = 0; f < filas; f++) {
    const dir = f % 2 === 0 ? 1 : -1, ry = oy + f * CELDA_H + 160 + 47;
    const col0 = dir > 0 ? 0 : COLS - 1;
    const xs = [];
    for (let i = 0; i < COLS; i++) xs.push(ox + (col0 + dir * i) * CELDA_W + CELDA_W / 2);
    xs[0] = dir > 0 ? ox + 4 : ox + QW - 4; xs[COLS - 1] = dir > 0 ? ox + QW - 4 : ox + 4;
    xs.forEach((x, i) => pts.push([x, ry + (fbm(x / 170, f + q * 7, 41) - 0.5) * 24 + (i === 0 || i === COLS - 1 ? 0 : 0)]));
    if (f < filas - 1) { const xe = dir > 0 ? ox + QW + 22 : ox - 22; pts.push([xe, ry + CELDA_H / 2]); }
  }
  return pts;
}
// ¿se cruzan dos segmentos? devuelve el punto o null
function cruce(a, b, c, d) {
  const x1 = a[0], y1 = a[1], x2 = b[0], y2 = b[1], x3 = c[0], y3 = c[1], x4 = d[0], y4 = d[1];
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den, u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [x1 + t * (x2 - x1), y1 + t * (y2 - y1), t, u] : null;
}

function curva(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

// ---------------- adornos (árboles, rocas...) ----------------
const ADORNOS = {
  arbol: (ctx, x, y, s) => E.arbol(ctx, x, y, 0.95 * s, '#3fa84f'),
  arbolOscuro: (ctx, x, y, s) => E.arbol(ctx, x, y, 0.9 * s, '#2f8f47'),
  pino: (ctx, x, y, s, nieve) => {
    E.rect(ctx, x - 2 * s, y - 8 * s, 4 * s, 9 * s, '#6b4a2f');
    for (let i = 0; i < 3; i++) { const w = (15 - i * 3.5) * s, yy = y - (8 + i * 11) * s; E.poli(ctx, [[x - w, yy], [x, yy - 17 * s], [x + w, yy]], i % 2 ? '#2f8a4a' : '#27793f'); if (nieve) E.poli(ctx, [[x - w * 0.62, yy - 7 * s], [x, yy - 17 * s], [x + w * 0.62, yy - 7 * s], [x, yy - 3 * s]], '#f4f8fc'); }
  },
  roca: (ctx, x, y, s, nieve) => { E.poli(ctx, [[x - 15 * s, y], [x - 10 * s, y - 13 * s], [x + 2 * s, y - 17 * s], [x + 14 * s, y - 8 * s], [x + 17 * s, y]], nieve ? '#c3cfdb' : '#8c8274'); E.poli(ctx, [[x - 10 * s, y - 13 * s], [x + 2 * s, y - 17 * s], [x + 4 * s, y - 6 * s], [x - 8 * s, y - 3 * s]], nieve ? '#e8eef5' : '#a79c8b'); },
  rocaD: (ctx, x, y, s) => { E.poli(ctx, [[x - 14 * s, y], [x - 9 * s, y - 12 * s], [x + 3 * s, y - 15 * s], [x + 13 * s, y - 7 * s], [x + 16 * s, y]], '#b98a5a'); E.poli(ctx, [[x - 9 * s, y - 12 * s], [x + 3 * s, y - 15 * s], [x + 4 * s, y - 5 * s], [x - 7 * s, y - 3 * s]], '#d4a875'); },
  cactus: (ctx, x, y, s) => { E.rrect(ctx, x - 4 * s, y - 28 * s, 8 * s, 28 * s, 4 * s, '#3f9b52'); E.rrect(ctx, x - 14 * s, y - 20 * s, 6 * s, 12 * s, 3 * s, '#3f9b52'); E.rect(ctx, x - 14 * s, y - 11 * s, 10 * s, 4 * s, '#3f9b52'); E.rrect(ctx, x + 8 * s, y - 24 * s, 6 * s, 14 * s, 3 * s, '#3f9b52'); E.rect(ctx, x + 3 * s, y - 13 * s, 8 * s, 4 * s, '#3f9b52'); E.rect(ctx, x - 1 * s, y - 28 * s, 1.4 * s, 28 * s, 'rgba(255,255,255,0.25)'); },
  palma: (ctx, x, y, s) => E.palmera(ctx, x, y, 1.05 * s),
  arbusto: (ctx, x, y, s) => { E.circ(ctx, x - 7 * s, y - 5 * s, 7 * s, '#3f9e4f'); E.circ(ctx, x + 6 * s, y - 5 * s, 7.5 * s, '#4cb05b'); E.circ(ctx, x, y - 10 * s, 8 * s, '#58bf66'); },
  seco: (ctx, x, y, s) => { E.circ(ctx, x - 6 * s, y - 4 * s, 6 * s, '#c9a85a'); E.circ(ctx, x + 6 * s, y - 4 * s, 7 * s, '#b99548'); E.circ(ctx, x, y - 8 * s, 7 * s, '#d4b66a'); },
  flores: (ctx, x, y, s, nieve, v) => { const cs = ['#ff6fa8', '#ffd24a', '#fff', '#b48cff']; for (let i = 0; i < 3; i++) { E.circ(ctx, x + (i - 1) * 7 * s, y - (i % 2) * 4 * s, 2.6 * s, cs[(Math.floor(v * 10) + i) % 4]); E.circ(ctx, x + (i - 1) * 7 * s, y - (i % 2) * 4 * s, 1 * s, '#f7c948'); } },
  montanaR: (ctx, x, y, s, nieve, v) => montana(ctx, x, y, 150 * s, (110 + v * 90) * s, false),
  montanaN: (ctx, x, y, s, nieve, v) => montana(ctx, x, y, 160 * s, (120 + v * 100) * s, true),
  ola: (ctx, x, y, s) => { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.quadraticCurveTo(x - 4 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 4 * s, y + 4 * s, x + 9 * s, y); ctx.stroke(); ctx.lineCap = 'butt'; },
  faro: (ctx, x, y) => {
    E.poli(ctx, [[x - 40, y + 4], [x - 24, y - 20], [x + 20, y - 24], [x + 46, y + 4]], '#7b7569'); E.poli(ctx, [[x - 24, y - 20], [x + 20, y - 24], [x + 26, y - 8], [x - 18, y - 6]], '#968f80');
    E.poli(ctx, [[x - 14, y - 16], [x + 14, y - 16], [x + 10, y - 86], [x - 10, y - 86]], '#f4f1ea');
    E.poli(ctx, [[x - 12, y - 44], [x + 12, y - 44], [x + 11, y - 58], [x - 11, y - 58]], '#e23b4a'); E.poli(ctx, [[x - 10.6, y - 72], [x + 10.6, y - 72], [x + 10, y - 86], [x - 10, y - 86]], '#e23b4a');
    E.rect(ctx, x - 12, y - 98, 24, 12, '#ffe9a0'); E.poli(ctx, [[x - 15, y - 98], [x, y - 112], [x + 15, y - 98]], '#b53a4a'); E.rect(ctx, x - 14, y - 88, 28, 4, '#555');
    E.poli(ctx, [[x + 12, y - 92], [x + 80, y - 104], [x + 80, y - 80]], 'rgba(255,240,150,0.28)');
  },
  barco: (ctx, x, y) => {
    E.elip(ctx, x, y + 6, 50, 9, 'rgba(0,0,0,0.18)'); E.poli(ctx, [[x - 46, y - 8], [x + 46, y - 8], [x + 32, y + 12], [x - 34, y + 12]], '#7a4a28'); E.rect(ctx, x - 44, y - 12, 90, 5, '#9a6234');
    E.rect(ctx, x - 2, y - 62, 4, 54, '#4a3220'); E.poli(ctx, [[x + 2, y - 60], [x + 34, y - 36], [x + 2, y - 18]], '#222'); E.poli(ctx, [[x - 2, y - 56], [x - 30, y - 34], [x - 2, y - 20]], '#2b2b2b');
    E.rect(ctx, x + 2, y - 70, 14, 8, '#222'); E.circ(ctx, x + 9, y - 66, 2.4, '#fff'); E.rect(ctx, x - 44, y - 16, 10, 6, '#6b3d20');
  },
  bote: (ctx, x, y) => { E.elip(ctx, x, y + 4, 22, 5, 'rgba(0,0,0,0.15)'); E.poli(ctx, [[x - 20, y - 4], [x + 20, y - 4], [x + 12, y + 7], [x - 12, y + 7]], '#e23b4a'); E.rect(ctx, x - 1.5, y - 28, 3, 24, '#555'); E.poli(ctx, [[x + 1.5, y - 28], [x + 16, y - 8], [x + 1.5, y - 8]], '#fff'); },
  iceberg: (ctx, x, y, s) => { E.poli(ctx, [[x - 30 * s, y], [x - 16 * s, y - 28 * s], [x - 4 * s, y - 18 * s], [x + 10 * s, y - 40 * s], [x + 30 * s, y]], '#e6f3fb'); E.poli(ctx, [[x - 4 * s, y - 18 * s], [x + 10 * s, y - 40 * s], [x + 14 * s, y - 10 * s], [x + 2 * s, y]], '#b9d6ea'); E.elip(ctx, x, y + 3, 34 * s, 5 * s, 'rgba(255,255,255,0.35)'); },
  letrero: (ctx, x, y, s, nieve, v, d) => {
    E.rect(ctx, x - 2, y - 52, 4, 52, '#6b4a2f'); E.rect(ctx, x - 1, y - 52, 1.5, 52, 'rgba(255,255,255,0.18)');
    ctx.font = `bold 13px ${E.FUENTE}`; const w = ctx.measureText(d.texto).width + 22;
    E.rrect(ctx, x - w / 2 + 1, y - 82, w, 28, 6, 'rgba(0,0,0,0.25)'); E.rrect(ctx, x - w / 2, y - 84, w, 28, 6, d.color); E.rrect(ctx, x - w / 2 + 2.5, y - 81.5, w - 5, 23, 4.5, 'rgba(255,255,255,0.18)');
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(d.texto, x, y - 64.5); ctx.textAlign = 'left';
  }
};
function montana(ctx, x, y, w, h, nieve) {
  const izq = nieve ? '#9db4cc' : '#b07d4f', der = nieve ? '#7b93ae' : '#8f6038', cima = [x + (w * 0.04), y - h];
  E.poli(ctx, [[x - w / 2, y], [cima[0], cima[1]], [cima[0] + w * 0.06, y]], izq);
  E.poli(ctx, [[cima[0], cima[1]], [x + w / 2, y], [cima[0] + w * 0.06, y]], der);
  E.poli(ctx, [[x - w * 0.14, y - h * 0.38], [cima[0], cima[1]], [x + w * 0.2, y - h * 0.34], [x + w * 0.06, y - h * 0.44], [x - w * 0.04, y - h * 0.3]], nieve ? '#ffffff' : '#c9a37a');
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cima[0], cima[1]); ctx.lineTo(cima[0] - w * 0.1, y - h * 0.4); ctx.lineTo(cima[0] - w * 0.2, y); ctx.stroke();
}

// ---------------- el mundo (se arma una vez) ----------------
function crearMundo(items, host, opciones) {
  const S = Math.max(3, Math.min(12, Number(opciones && opciones.S) || 4)); // 1 pixel del terreno = S del mundo
  const lotes = colocar(items), conteo = [0, 0, 0, 0];
  lotes.forEach((l) => { conteo[l.q]++; });
  const rios = [rioVertical(), rioHorizontal(), rioEste()];

  // caminos (serpientes por cuadrante + puentes entre cuadrantes + camino por el borde oeste)
  const caminos = [], ANCHO_CAMINO = 24;
  for (let q = 0; q < 4; q++) if (conteo[q]) caminos.push({ pts: caminoCuadrante(q, conteo[q]) });
  const extremo = (q, f, lado) => { const [ox, oy] = ORIGENES[q]; return [lado === 'e' ? ox + QW + 22 : ox - 22, oy + f * CELDA_H + 160 + 47]; };
  for (const [a, b] of [[0, 1], [2, 3]]) for (let f = 0; f < FILAS; f += 2) if (conteo[a] > f * COLS && conteo[b] > f * COLS) { const p = extremo(a, f, 'e'), r = extremo(b, f, 'o'); caminos.push({ pts: [p, [(p[0] + r[0]) / 2, p[1]], r] }); }
  if (conteo[0] && conteo[2]) { const xo = MO - 62; caminos.push({ pts: [[ORIGENES[0][0] + 4, ORIGENES[0][1] + 207], [xo, ORIGENES[0][1] + 207], [xo - 6, CY - 120], [xo, CY], [xo + 6, ORIGENES[2][1] + 180], [xo, ORIGENES[2][1] + 207], [ORIGENES[2][0] + 4, ORIGENES[2][1] + 207]] }); }

  if (conteo[1] && conteo[3]) { const xe = ORIGENES[1][0] + QW, y2 = ORIGENES[1][1] + 207, y4 = ORIGENES[3][1] + 207; caminos.push({ pts: [[xe - 4, y2], [xe + 66, y2], [xe + 72, CY - 120], [xe + 66, CY], [xe + 72, y4 - 60], [xe + 66, y4], [xe - 4, y4]] }); }

  // lagos y oasis en los huecos que dejan los comercios (celdas libres)
  const lagos = [];
  CUADRANTES.forEach((cats, q) => {
    const [ox, oy] = ORIGENES[q], n = conteo[q], usadas = Math.ceil(n / COLS), tipo = ['oasis', 'hielo', 'lago', 'lago'][q];
    if (!n) return;
    const m = n - (usadas - 1) * COLS, libres = COLS - m;
    if (libres >= 3) { const f = usadas - 1, a = f % 2 === 0 ? m : 0, cx = ox + (a + libres / 2) * CELDA_W, rx = Math.min(210, libres * CELDA_W * 0.36); lagos.push({ x: cx, y: oy + f * CELDA_H + 118, rx, ry: rx * 0.42, tipo }); }
    for (let f = usadas; f < FILAS; f++) { const r = E.rng(E.hash('lago' + q + f)); const rx = 140 + r() * 60; lagos.push({ x: ox + QW * (0.28 + 0.44 * r()), y: oy + f * CELDA_H + 105, rx, ry: rx * 0.4, tipo }); }
  });

  // puentes: donde un camino cruza un río
  const puentes = [];
  for (const c of caminos) for (let i = 0; i < c.pts.length - 1; i++) for (const r of rios) for (let j = 0; j < r.pts.length - 1; j++) {
    const p = cruce(c.pts[i], c.pts[i + 1], r.pts[j], r.pts[j + 1]);
    if (p) puentes.push({ x: p[0], y: p[1], ang: Math.atan2(c.pts[i + 1][1] - c.pts[i][1], c.pts[i + 1][0] - c.pts[i][0]), largo: r.ancho(j) + 40 });
  }

  // terreno (imagen pequeña que luego se estira)
  const LW = Math.ceil(ANCHO / S), LH = Math.ceil(ALTO / S), terreno = host.crearLienzo(LW, LH), tc = terreno.getContext('2d'), img = tc.getImageData(0, 0, LW, LH);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const c = colorTerreno(x * S + S / 2, y * S + S / 2), i = (y * LW + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
  tc.putImageData(img, 0, 0);

  // zonas ocupadas (para que los árboles no caigan encima de caminos, ríos o edificios)
  const mk = host.crearLienzo(LW, LH), mc = mk.getContext('2d');
  mc.scale(1 / S, 1 / S); mc.fillStyle = '#fff'; mc.strokeStyle = '#fff'; mc.lineCap = 'round'; mc.lineJoin = 'round';
  for (const r of rios) { mc.lineWidth = 120; curva(mc, r.pts); mc.stroke(); }
  for (const c of caminos) { mc.lineWidth = 62; curva(mc, c.pts); mc.stroke(); }
  for (const l of lotes) { mc.beginPath(); mc.ellipse(l.x, l.y - 4, 112, 52, 0, 0, PI * 2); mc.fill(); mc.fillRect(l.x - 96, l.y - 200, 192, 215); }
  for (const g of lagos) { mc.beginPath(); mc.ellipse(g.x, g.y, g.rx + 30, g.ry + 30, 0, 0, PI * 2); mc.fill(); }
  const ocupado = mc.getImageData(0, 0, LW, LH).data;
  const libre = (x, y) => { const px = Math.floor(x / S), py = Math.floor(y / S); return px >= 0 && py >= 0 && px < LW && py < LH && ocupado[(py * LW + px) * 4 + 3] < 20; };

  // adornos repartidos por zona
  const adornos = [], rg = E.rng(20260);
  const meter = (t, x, y, s = 1, extra) => adornos.push({ t, x, y, s, v: rg(), ...(extra || {}) });
  for (let Y = 16; Y < ALTO; Y += 36) for (let X = 16; X < ANCHO; X += 36) {
    const x = X + (rg() - 0.5) * 34, y = Y + (rg() - 0.5) * 34, dm = distMar(x, y);
    if (dm > -24 || !libre(x, y) || y < MN - 10) continue;
    const b = biomaDe(x, y), r = rg(), s = 0.85 + rg() * 0.5, borde = x < MO + 20 || x > ANCHO - ME - 10 || y > ALTO - MS - 20;
    const dens = borde ? 0.95 : 0.5;
    if (rg() > dens) continue;
    if (dm > -90 && b !== 'n') { if (r < 0.7) meter('palma', x, y, s); continue; }
    if (b === 'd') meter(r < 0.38 ? 'cactus' : r < 0.55 ? 'rocaD' : r < 0.7 ? 'seco' : r < 0.8 ? 'palma' : 'rocaD', x, y, s);
    else if (b === 'n') meter(r < 0.6 ? 'pinoN' : r < 0.8 ? 'rocaN' : 'pinoN', x, y, s);
    else if (b === 'r') meter(r < 0.4 ? 'pino' : r < 0.8 ? 'roca' : 'arbusto', x, y, s);
    else meter(r < 0.42 ? 'arbol' : r < 0.6 ? 'arbolOscuro' : r < 0.72 ? 'pino' : r < 0.82 ? 'arbusto' : 'flores', x, y, s);
  }
  for (const g of lagos) { const r = E.rng(E.hash('ad' + g.x)); for (let i = 0; i < 9; i++) { const a = r() * PI * 2, x = g.x + Math.cos(a) * (g.rx + 18 + r() * 26), y = g.y + Math.sin(a) * (g.ry + 14 + r() * 18); if (g.tipo === 'oasis' && i < 6) meter('palma', x, y, 1 + r() * 0.3); else if (g.tipo === 'hielo') meter(i % 3 ? 'pinoN' : 'rocaN', x, y, 0.9 + r() * 0.4); else if (g.tipo === 'lago' && i < 6) meter(i % 2 ? 'arbusto' : 'flores', x, y, 1 + r() * 0.3); } }
  // montañas en el borde norte y rocas altas en el borde oeste
  for (let x = -40; x < ANCHO + 60; x += 70 + rg() * 30) { const n = x > CX + 150 || (x > CX - 150 && rg() < 0.5); meter(n ? 'montanaN' : 'montanaR', x, 134 + rg() * 26, 1 + rg() * 0.5); }
  for (let y = 190; y < ALTO - MS - 50; y += 120 + rg() * 60) { meter('roca', 30 + rg() * 40, y, 2.2 + rg()); meter(y < CY ? 'rocaD' : 'roca', 20 + rg() * 30, y + 40, 2 + rg() * 0.8); }
  // olas, barcos, faro e icebergs en el mar
  for (let i = 0; i < 520; i++) { const x = rg() * ANCHO, y = rg() * ALTO; if (distMar(x, y) > 40) meter('ola', x, y, 1 + rg()); }
  meter('faro', ANCHO - ME + 80, CY + 640, 1); meter('barco', ANCHO - 140, ALTO - 340, 1); meter('bote', ANCHO - 260, ALTO - 150, 1); meter('bote', ANCHO - 120, CY + 330, 1); meter('bote', 600 + 1400, ALTO - 130, 1);
  meter('iceberg', ANCHO - 110, 330, 1.6); meter('iceberg', ANCHO - 200, 560, 1.1); meter('iceberg', ANCHO - 70, 760, 1.3);
  // letrero de cada zona (en el primer comercio de cada categoría)
  const colorCat = {}; items.forEach((it) => { if (it.colorCat) colorCat[it.cat] = it.colorCat; });
  const vistos = {};
  for (const l of lotes) if (!vistos[l.cat + '/' + l.q]) { vistos[l.cat + '/' + l.q] = 1; const it = items.find((x) => x.id === l.id); if (it && it.nombreCat) meter('letrero', l.x - 104, l.y + 8, 1, { texto: it.nombreCat.toUpperCase(), color: it.colorCat || '#444' }); }

  return { lotes, caminos, rios, puentes, lagos, terreno, adornos, libre, ANCHO, ALTO, ANCHO_CAMINO };
}

// ---------------- dibujo ----------------
function pintarRio(ctx, r) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const trazo = (extra, color) => { for (let i = 0; i < r.pts.length - 1; i += 1) { const a = r.pts[i], b = r.pts[i + 1]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = r.ancho(i) + extra; ctx.strokeStyle = color; ctx.stroke(); } };
  trazo(22, '#e3d29b'); trazo(8, '#1f8fc4'); trazo(0, '#3bb8e6'); trazo(-26, '#7fd9f1');
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.4; ctx.setLineDash([16, 34]);
  for (const off of [-12, 12]) { ctx.beginPath(); r.pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + off, p[1]) : ctx.moveTo(p[0] + off, p[1]))); ctx.stroke(); }
  ctx.setLineDash([]); ctx.lineCap = 'butt';
}
function pintarLago(ctx, g) {
  const hielo = g.tipo === 'hielo', orilla = hielo ? '#e9f3fb' : g.tipo === 'oasis' ? '#f0d99a' : '#d8c98f';
  const el = (rx, ry, color) => { ctx.beginPath(); ctx.ellipse(g.x, g.y, rx, ry, 0, 0, PI * 2); ctx.fillStyle = color; ctx.fill(); };
  el(g.rx + 22, g.ry + 16, 'rgba(0,0,0,0.12)'); el(g.rx + 18, g.ry + 11, orilla);
  el(g.rx + 2, g.ry + 1, hielo ? '#bfe3f4' : '#1f8fc4'); el(g.rx - 8, g.ry - 7, hielo ? '#d8f0fb' : '#3bb8e6'); el(g.rx - 34, g.ry - 22, hielo ? '#ecf9ff' : '#7fd9f1');
  ctx.strokeStyle = hielo ? 'rgba(120,170,200,0.55)' : 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const x = g.x + (i - 1.5) * g.rx * 0.38, y = g.y + ((i % 2) - 0.5) * g.ry * 0.7; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 5, y - 5, x, y); ctx.quadraticCurveTo(x + 5, y + 5, x + 12, y); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
function pintarCamino(ctx, c, ancho) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  curva(ctx, c.pts); ctx.lineWidth = ancho + 7; ctx.strokeStyle = '#8f7a55'; ctx.stroke();
  curva(ctx, c.pts); ctx.lineWidth = ancho; ctx.strokeStyle = '#dccba0'; ctx.stroke();
  curva(ctx, c.pts); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([12, 16]); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
}
function pintarPuente(ctx, p, ancho) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
  const L = p.largo, W = ancho + 12;
  E.rect(ctx, -L / 2 - 2, -W / 2 - 3, L + 4, W + 6, 'rgba(0,0,0,0.20)');
  E.rect(ctx, -L / 2, -W / 2, L, W, '#b98a52');
  for (let x = -L / 2 + 6; x < L / 2; x += 9) E.rect(ctx, x, -W / 2, 1.6, W, 'rgba(70,40,15,0.45)');
  E.rect(ctx, -L / 2, -W / 2 - 4, L, 5, '#7c5430'); E.rect(ctx, -L / 2, W / 2 - 1, L, 5, '#7c5430');
  for (let x = -L / 2; x <= L / 2; x += L / 4) { E.rect(ctx, x - 2, -W / 2 - 8, 4, 10, '#5e3f22'); E.rect(ctx, x - 2, W / 2 - 2, 4, 10, '#5e3f22'); }
  ctx.restore();
}

// mundo: lo que devuelve crearMundo. estados: [{ id, cat, nombre, color, gris, nivel, maxNivel, exclusiva, pareja }]
// opciones: { escala = 1, region = [x, y, w, h] }  (region en coordenadas del mundo)
function pintar(ctx, mundo, estados, { escala = 1, region = null } = {}) {
  const [rx, ry, rw, rh] = region || [0, 0, ANCHO, ALTO], porId = {};
  for (const e of estados) porId[e.id] = e;
  ctx.save();
  ctx.scale(escala, escala); ctx.translate(-rx, -ry);
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.drawImage(mundo.terreno, 0, 0, ANCHO, ALTO);
  for (const r of mundo.rios) pintarRio(ctx, r);
  for (const g of mundo.lagos) pintarLago(ctx, g);
  for (const c of mundo.caminos) pintarCamino(ctx, c, mundo.ANCHO_CAMINO);
  for (const p of mundo.puentes) pintarPuente(ctx, p, mundo.ANCHO_CAMINO);
  for (const l of mundo.lotes) { // plaza de cada comercio
    ctx.beginPath(); ctx.ellipse(l.x, l.y - 4, 100, 44, 0, 0, PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(l.x, l.y - 6, 98, 42, 0, 0, PI * 2); ctx.fillStyle = '#e9dcb8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#bba97d'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(l.x, l.y - 7, 84, 33, 0, 0, PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  }
  // todo lo que tiene "profundidad" se dibuja de atrás hacia adelante
  const cola = [];
  const dentro = (x, y, m) => x > rx - m && x < rx + rw + m && y > ry - m && y < ry + rh + m + 60;
  for (const a of mundo.adornos) if (dentro(a.x, a.y, 200)) cola.push({ y: a.y, f: () => dibujarAdorno(ctx, a) });
  for (const l of mundo.lotes) if (dentro(l.x, l.y, 160)) { const e = porId[l.id]; if (e) cola.push({ y: l.y, f: () => E.comercio(ctx, e, l.x, l.y, 1) }); }
  cola.sort((a, b) => a.y - b.y);
  for (const c of cola) c.f();
  ctx.restore();
}
function dibujarAdorno(ctx, a) {
  switch (a.t) {
    case 'pinoN': return ADORNOS.pino(ctx, a.x, a.y, a.s, true);
    case 'rocaN': return ADORNOS.roca(ctx, a.x, a.y, a.s, true);
    default: return (ADORNOS[a.t] || ADORNOS.arbol)(ctx, a.x, a.y, a.s, false, a.v, a);
  }
}

const API = { crearMundo, pintar, colocar, ANCHO, ALTO, CX, CY, PARTES, CUADRANTES, NOMBRE_CUADRANTE, CELDA_W, CELDA_H };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MapaMundo = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);

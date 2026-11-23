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

function estrella(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function hex(c, a) {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function crearMapa(d) {
  const { createCanvas } = cargarCanvas();
  const W = 1100, PAD = 28, COLS = 4, GAP = 12, TW = Math.floor((W - PAD * 2 - 24 - GAP * (COLS - 1)) / COLS), TH = 78;
  const HEAD = 230, ZONA_T = 40, CALLE = 26;

  const zonas = d.categorias.map((c) => ({ c, items: d.items.filter((i) => i.cat === c.id).sort((a, b) => b.hora - a.hora) })).filter((z) => z.items.length);
  let alto = HEAD;
  for (const z of zonas) { z.filas = Math.ceil(z.items.length / COLS); z.alto = ZONA_T + 14 + z.filas * (TH + GAP) + 4; alto += z.alto + CALLE; }
  alto += 90;

  const ESC = Math.min(1.5, 4200 / alto);
  const lienzo = createCanvas(Math.round(W * ESC), Math.round(alto * ESC));
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESC, ESC);

  const fondo = ctx.createLinearGradient(0, 0, 0, alto);
  fondo.addColorStop(0, '#0b1d2b'); fondo.addColorStop(1, '#0c2a22');
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, alto);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, alto); ctx.stroke(); }
  for (let y = 0; y < alto; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  rr(ctx, PAD, 22, W - PAD * 2, HEAD - 40, 22);
  ctx.fillStyle = 'rgba(8,16,26,0.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,90,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd25a'; ctx.font = `bold 34px ${F}`; ctx.textAlign = 'left';
  ctx.fillText('MAPA DE PROPIEDADES', PAD + 24, 74);
  ctx.fillStyle = '#b9e0ff'; ctx.font = `20px ${F}`;
  const sub = recortar(ctx, `Imperio de ${d.nombre}` + (d.compartido ? `  ·  compartido con ${d.nombrePareja || 'tu pareja'}` : ''), W - PAD * 2 - 48);
  ctx.fillText(sub, PAD + 24, 104);

  const cajas = [
    ['PROPIEDADES', `${d.cantidad} / ${d.total}`, '#b48cff'],
    ['POR HORA', compacto(d.porHora), '#4de3a0'],
    ['EN 24 HORAS', compacto(d.en24), '#ffd25a'],
    ['POR COBRAR YA', compacto(d.porCobrar), '#ff9a4d']
  ];
  const bw = Math.floor((W - PAD * 2 - 48 - 3 * 14) / 4);
  cajas.forEach(([t, v, col], i) => {
    const x = PAD + 24 + i * (bw + 14), y = 124;
    rr(ctx, x, y, bw, 66, 14); ctx.fillStyle = hex(col, 0.14); ctx.fill();
    ctx.strokeStyle = hex(col, 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `bold 13px ${F}`; ctx.fillText(t, x + 14, y + 22);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 28px ${F}`; ctx.fillText(recortar(ctx, v, bw - 24), x + 14, y + 54);
  });

  let y = HEAD;
  for (const z of zonas) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y - CALLE + 6, W, CALLE - 12);
    ctx.strokeStyle = 'rgba(255,230,120,0.35)'; ctx.setLineDash([14, 12]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y - CALLE / 2); ctx.lineTo(W, y - CALLE / 2); ctx.stroke(); ctx.setLineDash([]);

    rr(ctx, PAD, y, W - PAD * 2, z.alto, 18);
    ctx.fillStyle = hex(z.c.color, 0.10); ctx.fill();
    ctx.strokeStyle = hex(z.c.color, 0.55); ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = z.c.color; ctx.font = `bold 20px ${F}`; ctx.textAlign = 'left';
    ctx.fillText(`ZONA ${limpiar(z.c.nombre).toUpperCase()}`, PAD + 20, y + 28);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `15px ${F}`; ctx.textAlign = 'right';
    ctx.fillText(`${z.items.length} propiedad${z.items.length === 1 ? '' : 'es'}  ·  ${compacto(z.items.reduce((t, i) => t + i.hora, 0))}/h`, W - PAD - 20, y + 27);
    ctx.textAlign = 'left';

    z.items.forEach((it, k) => {
      const fx = PAD + 12 + (k % COLS) * (TW + GAP), fy = y + ZONA_T + 6 + Math.floor(k / COLS) * (TH + GAP);
      rr(ctx, fx, fy, TW, TH, 12);
      const g = ctx.createLinearGradient(fx, fy, fx, fy + TH);
      g.addColorStop(0, hex(z.c.color, it.deMiPareja ? 0.16 : 0.34)); g.addColorStop(1, 'rgba(10,18,28,0.92)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = it.bono ? '#ff6fa8' : hex(z.c.color, 0.85); ctx.lineWidth = it.bono ? 2.6 : 1.6;
      if (it.deMiPareja) ctx.setLineDash([6, 5]);
      ctx.stroke(); ctx.setLineDash([]);
      rr(ctx, fx, fy, 8, TH, 4); ctx.fillStyle = z.c.color; ctx.fill();

      const tx = fx + 18, tw = TW - 28 - (it.exclusiva ? 20 : 0);
      ctx.fillStyle = '#ffffff'; ctx.font = `bold 15px ${F}`; ctx.fillText(recortar(ctx, it.nombre, tw), tx, fy + 25);
      ctx.fillStyle = '#7dffc0'; ctx.font = `bold 18px ${F}`; ctx.fillText(`${compacto(it.hora)}/h`, tx, fy + 50);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `12px ${F}`;
      ctx.fillText(`24h: ${compacto(it.hora * 24)}`, tx, fy + 68);

      const pips = it.maxNivel;
      for (let p = 0; p < pips; p++) {
        const px = fx + TW - 16 - (pips - 1 - p) * 13, py = fy + TH - 20;
        rr(ctx, px - 5, py, 10, 10, 3);
        ctx.fillStyle = p < it.nivel ? '#ffd25a' : 'rgba(255,255,255,0.18)'; ctx.fill();
      }
      if (it.exclusiva) estrella(ctx, fx + TW - 16, fy + 17, 9, '#ffd25a');
      if (it.bono) {
        rr(ctx, fx + TW - 58, fy + TH - 46, 44, 20, 10); ctx.fillStyle = '#ff6fa8'; ctx.fill();
        ctx.fillStyle = '#2a0f22'; ctx.font = `bold 12px ${F}`; ctx.textAlign = 'center'; ctx.fillText('x1.5', fx + TW - 36, fy + TH - 31); ctx.textAlign = 'left';
      } else if (it.deMiPareja) {
        ctx.fillStyle = '#ffc2dc'; ctx.font = `italic 11px ${F}`; ctx.textAlign = 'right'; ctx.fillText('de tu pareja', fx + TW - 12, fy + TH - 31); ctx.textAlign = 'left';
      }
    });
    y += z.alto + CALLE;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `14px ${F}`; ctx.textAlign = 'left';
  ctx.fillText('Cuadritos amarillos = mejoras  ·  borde rosa x1.5 = bono de pareja  ·  borde punteado = de tu pareja  ·  estrella = exclusiva', PAD, alto - 52);
  ctx.fillStyle = '#ffd25a'; ctx.font = `bold 16px ${F}`;
  ctx.fillText(`Lo que se junta llega hasta 24 horas. Cóbralo con .recolectar` + (d.bonos ? `   ·   ${d.bonos} con bono de pareja` : ''), PAD, alto - 26);
  return lienzo.toBuffer('image/png');
}

module.exports = { crearMapa, compacto };

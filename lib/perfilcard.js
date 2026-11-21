// lib/perfilcard.js
// Dibuja la tarjeta de .perfil como imagen PNG (foto, colores por tema, estadisticas, boda e hijos).
// Usa @napi-rs/canvas y las fuentes DejaVu de assets/fonts. No dibuja emojis (en un VPS sin fuente
// de emojis saldrian como cuadritos): los corazones y adornos se dibujan como formas.
const path = require('path');
const fs = require('fs');

const CARPETA_FUENTES = path.join(__dirname, '..', 'assets', 'fonts');
const F = 'PerfilSans';
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

const TEMAS = {
  rosa:     { a: '#2a0f22', b: '#5a1b42', acento: '#ff6fa8', suave: '#ffc2dc' },
  azul:     { a: '#0b1a38', b: '#16396b', acento: '#5cb8ff', suave: '#b9e0ff' },
  morado:   { a: '#1c0f38', b: '#44207a', acento: '#b48cff', suave: '#dcc9ff' },
  verde:    { a: '#0a2a21', b: '#145a42', acento: '#4de3a0', suave: '#b6f5d9' },
  rojo:     { a: '#2d0b10', b: '#681624', acento: '#ff5c6c', suave: '#ffc0c6' },
  dorado:   { a: '#241b07', b: '#54400f', acento: '#ffd25a', suave: '#ffeab0' },
  negro:    { a: '#0a0a0d', b: '#22222c', acento: '#e8e8f0', suave: '#c9c9d6' },
  naranja:  { a: '#2e1305', b: '#65300b', acento: '#ff9a4d', suave: '#ffd3b0' },
  amarillo: { a: '#2a2506', b: '#585010', acento: '#ffe94d', suave: '#fff5a8' }
};

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu;
const limpiar = (t) => { let s = String(t == null ? '' : t).replace(/\s+/g, ' '); if (!hayEmoji) s = s.replace(EMOJI, ''); return s.trim(); };

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

function corazon(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 20, s / 20);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-14, -3, -8, -13, 0, -6);
  ctx.bezierCurveTo(8, -13, 14, -3, 0, 7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function recortar(ctx, texto, maxAncho) {
  let t = limpiar(texto);
  if (ctx.measureText(t).width <= maxAncho) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxAncho) t = t.slice(0, -1);
  return t + '…';
}

function envolver(ctx, texto, maxAncho, maxLineas) {
  const palabras = limpiar(texto).split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const c = actual ? actual + ' ' + p : p;
    if (ctx.measureText(c).width <= maxAncho) { actual = c; continue; }
    if (actual) lineas.push(actual);
    actual = p;
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const cortadas = lineas.slice(0, maxLineas);
    cortadas[maxLineas - 1] = recortar(ctx, cortadas[maxLineas - 1] + '…', maxAncho);
    return cortadas;
  }
  return lineas;
}

const dinero = (n) => Number(n || 0).toLocaleString('es-MX');

// d = { nombre, titulo, desc, genero, cumple, tema, avatar(Buffer|null), saldo, banco, warns,
//       pareja: nombre|null, boda: { fecha, dias }|null, hijos: [nombres], padres: [nombres] }
async function dibujarPerfil(d) {
  const L = cargarCanvas();
  const T = TEMAS[d.tema] || TEMAS.rosa;
  const W = 1000;

  // Medimos primero para saber cuanto mide la tarjeta
  const medida = L.createCanvas(10, 10).getContext('2d');
  medida.font = `22px ${F}`;
  const chipsAncho = 880;
  const medirChips = (lista) => {
    let x = 0; let filas = 1;
    for (const n of lista) {
      const w = Math.min(medida.measureText(limpiar(n)).width + 44, 420);
      if (x + w > chipsAncho) { filas++; x = 0; }
      x += w + 12;
    }
    return filas;
  };
  const hijos = Array.isArray(d.hijos) ? d.hijos : [];
  const padres = Array.isArray(d.padres) ? d.padres : [];

  let altoFamilia = 70;                 // titulo de seccion
  altoFamilia += d.pareja ? 150 : 70;   // pareja o soltero
  if (hijos.length) altoFamilia += 44 + medirChips(hijos) * 52 + 14;
  if (padres.length) altoFamilia += 44 + medirChips(padres) * 52 + 14;
  const H = 40 + 330 + 30 + 120 + 30 + altoFamilia + 60;

  const lienzo = L.createCanvas(W, H);
  const ctx = lienzo.getContext('2d');

  // Fondo
  const fondo = ctx.createLinearGradient(0, 0, W, H);
  fondo.addColorStop(0, T.a); fondo.addColorStop(1, T.b);
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.10; ctx.fillStyle = T.acento;
  ctx.beginPath(); ctx.arc(W - 80, 60, 260, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.07;
  ctx.beginPath(); ctx.arc(60, H - 40, 300, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffffff';
  for (let y = 24; y < H; y += 36) for (let x = 24 + ((y / 36) % 2) * 18; x < W; x += 36) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  // Borde de la tarjeta
  rr(ctx, 14, 14, W - 28, H - 28, 34);
  ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1;

  // ===== Cabecera =====
  const py = 40;
  rr(ctx, 40, py, W - 80, 330, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();

  // Avatar con aro y brillo
  const ax = 190; const ay = py + 165; const ar = 112;
  ctx.save();
  ctx.shadowColor = T.acento; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(ax, ay, ar + 10, 0, Math.PI * 2);
  const aro = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
  aro.addColorStop(0, T.suave); aro.addColorStop(1, T.acento);
  ctx.fillStyle = aro; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(ax, ay, ar + 3, 0, Math.PI * 2); ctx.fillStyle = T.a; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
  let pintada = false;
  if (d.avatar) {
    try {
      const img = await L.loadImage(d.avatar);
      const lado = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, ax - ar, ay - ar, ar * 2, ar * 2);
      pintada = true;
    } catch (_) { pintada = false; }
  }
  if (!pintada) {
    const g = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
    g.addColorStop(0, T.acento); g.addColorStop(1, T.b);
    ctx.fillStyle = g; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 120px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((limpiar(d.nombre).replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase(), ax, ay + 6);
  }
  ctx.restore();

  // Nombre, titulo, descripcion
  const tx = 350; const tw = W - tx - 70;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let tam = 56;
  ctx.font = `bold ${tam}px ${F}`;
  while (tam > 30 && ctx.measureText(limpiar(d.nombre)).width > tw) { tam -= 2; ctx.font = `bold ${tam}px ${F}`; }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillText(recortar(ctx, d.nombre, tw), tx, py + 96);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  let y = py + 96;
  const titulo = limpiar(d.titulo);
  if (titulo) {
    ctx.font = `bold 24px ${F}`;
    const w = Math.min(ctx.measureText(titulo).width + 40, tw);
    y += 24;
    rr(ctx, tx, y, w, 42, 21);
    const gp = ctx.createLinearGradient(tx, 0, tx + w, 0); gp.addColorStop(0, T.acento); gp.addColorStop(1, T.suave);
    ctx.fillStyle = gp; ctx.fill();
    ctx.fillStyle = T.a; ctx.textBaseline = 'middle';
    ctx.fillText(recortar(ctx, titulo, w - 30), tx + 20, y + 22);
    ctx.textBaseline = 'alphabetic';
    y += 42;
  }
  y += 40;
  ctx.font = `24px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const desc = limpiar(d.desc);
  if (desc) {
    for (const l of envolver(ctx, desc, tw, 3)) { ctx.fillText(l, tx, y); y += 32; }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Sin descripción', tx, y); y += 32;
  }
  // Datos pequenos (genero, cumple)
  const datos = [];
  if (d.genero) datos.push(limpiar(d.genero));
  if (d.cumple) datos.push('Cumple: ' + limpiar(d.cumple));
  if (datos.length) {
    ctx.font = `21px ${F}`; ctx.fillStyle = T.suave;
    ctx.fillText(recortar(ctx, datos.join('   ·   '), tw), tx, py + 330 - 28);
  }

  // ===== Estadisticas =====
  const sy = py + 330 + 30;
  const stats = [['SALDO', '$' + dinero(d.saldo)], ['BANCO', '$' + dinero(d.banco)], ['ADVERTENCIAS', String(d.warns || 0)]];
  const sw = (W - 80 - 40) / 3;
  stats.forEach((s, i) => {
    const x = 40 + i * (sw + 20);
    rr(ctx, x, sy, sw, 120, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = `bold 19px ${F}`; ctx.fillStyle = T.suave; ctx.fillText(s[0], x + sw / 2, sy + 40);
    ctx.font = `bold 40px ${F}`; ctx.fillStyle = '#ffffff';
    let v = s[1]; while (ctx.measureText(v).width > sw - 30 && v.length > 3) v = v.slice(0, -1);
    ctx.fillText(v, x + sw / 2, sy + 92);
  });

  // ===== Familia =====
  let fy = sy + 120 + 30;
  rr(ctx, 40, fy, W - 80, altoFamilia, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `bold 26px ${F}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('FAMILIA', 80, fy + 46);
  const lin = ctx.createLinearGradient(210, 0, W - 70, 0); lin.addColorStop(0, T.acento); lin.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lin; ctx.fillRect(210, fy + 38, W - 70 - 210, 3);
  corazon(ctx, W - 100, fy + 40, 30, T.acento);
  let cy = fy + 70;

  if (d.pareja) {
    // Pareja
    rr(ctx, 70, cy, W - 140, 130, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
    corazon(ctx, 120, cy + 65, 50, T.acento);
    ctx.fillStyle = T.suave; ctx.font = `bold 19px ${F}`; ctx.fillText('CASADO/A CON', 170, cy + 38);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${F}`;
    ctx.fillText(recortar(ctx, d.pareja, 430), 170, cy + 80);
    if (d.boda) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `21px ${F}`;
      ctx.fillText('Boda: ' + limpiar(d.boda.fecha), 170, cy + 112);
      // Dias de casados (caja a la derecha)
      const bx = W - 70 - 250; rr(ctx, bx, cy + 14, 230, 102, 18);
      const gb = ctx.createLinearGradient(bx, cy, bx + 230, cy + 116); gb.addColorStop(0, T.acento); gb.addColorStop(1, T.suave);
      ctx.fillStyle = gb; ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = T.a;
      ctx.font = `bold 52px ${F}`; ctx.fillText(String(d.boda.dias), bx + 115, cy + 72);
      ctx.font = `bold 19px ${F}`; ctx.fillText(d.boda.dias === 1 ? 'DÍA DE CASADOS' : 'DÍAS DE CASADOS', bx + 115, cy + 100);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `20px ${F}`;
      ctx.fillText('Fecha de boda no registrada', 170, cy + 112);
    }
    cy += 150;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `26px ${F}`;
    ctx.fillText('Estado: Soltero/a', 80, cy + 34);
    cy += 70;
  }

  const filaChips = (titulo, lista) => {
    ctx.fillStyle = T.suave; ctx.font = `bold 20px ${F}`; ctx.textAlign = 'left';
    ctx.fillText(titulo, 80, cy + 22);
    cy += 44;
    let x = 80; ctx.font = `22px ${F}`;
    for (const nombre of lista) {
      const t = recortar(ctx, nombre, 380);
      const w = ctx.measureText(t).width + 44;
      if (x + w > 80 + chipsAncho) { x = 80; cy += 52; }
      rr(ctx, x, cy, w, 40, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x + 20, cy + 20, 5, 0, Math.PI * 2); ctx.fillStyle = T.acento; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 32, cy + 21); ctx.textBaseline = 'alphabetic';
      x += w + 12;
    }
    cy += 52 + 14 - 12;
  };
  if (hijos.length) filaChips(`HIJOS (${hijos.length})`, hijos);
  if (padres.length) filaChips('PADRES', padres);

  // Pie
  ctx.textAlign = 'center'; ctx.font = `18px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('ALEPANDA-BOT  ·  .editarperfil para personalizar', W / 2, H - 30);
  return lienzo;
}

async function crearPerfil(d) {
  const lienzo = await dibujarPerfil(d);
  return lienzo.toBuffer('image/png');
}

module.exports = { crearPerfil, dibujarPerfil, TEMAS };

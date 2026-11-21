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


// Marcos disponibles para la foto del perfil
const MARCOS = ['circulo', 'cuadrado', 'hexagono', 'diamante', 'corazon', 'estrella'];
function trazarMarco(ctx, tipo, cx, cy, r) {
  ctx.beginPath();
  const poligono = (n, giro, rad) => {
    for (let i = 0; i < n; i++) {
      const a = giro + (i * 2 * Math.PI) / n;
      const x = cx + rad * Math.cos(a); const y = cy + rad * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  switch (tipo) {
    case 'cuadrado': rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.28); break;
    case 'hexagono': poligono(6, Math.PI / 6, r * 1.05); break;
    case 'diamante': poligono(4, 0, r * 1.18); break;
    case 'estrella': {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r * 1.2 : r * 0.55;
        const x = cx + rad * Math.cos(a); const y = cy + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'corazon': {
      const s = r / 10;
      ctx.moveTo(cx, cy + 9.2 * s);
      ctx.bezierCurveTo(cx - 17 * s, cy - 2 * s, cx - 10 * s, cy - 14 * s, cx, cy - 6 * s);
      ctx.bezierCurveTo(cx + 10 * s, cy - 14 * s, cx + 17 * s, cy - 2 * s, cx, cy + 9.2 * s);
      ctx.closePath();
      break;
    }
    default: ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

const dinero = (n) => Number(n || 0).toLocaleString('es-MX');

// Tarjeta grande: se disena en un lienzo de 1000 de ancho y se saca ESCALA veces mas grande (nitida y mas grande en el chat).
// Letras mas grandes que antes y la descripcion tiene su propio recuadro (hasta MAX_LINEAS_DESC lineas) para poder ser larga.
const ESCALA = 1.5;
const MAX_LINEAS_DESC = 10;

// d = { nombre, titulo, desc, genero, cumple, tema, avatar(Buffer|null), saldo, banco, warns,
//       pareja: nombre|null, boda: { fecha, dias }|null, hijos: [nombres], padres: [nombres] }
async function dibujarPerfil(d) {
  const L = cargarCanvas();
  const T = TEMAS[d.tema] || TEMAS.rosa;
  const W = 1000;

  // Medimos primero para saber cuanto mide la tarjeta
  const medida = L.createCanvas(10, 10).getContext('2d');
  const chipsAncho = 840;
  medida.font = `26px ${F}`;
  const medirChips = (lista) => {
    let x = 0; let filas = 1;
    for (const n of lista) {
      const w = Math.min(medida.measureText(limpiar(n)).width + 52, 430);
      if (x + w > chipsAncho) { filas++; x = 0; }
      x += w + 12;
    }
    return filas;
  };
  const hijos = Array.isArray(d.hijos) ? d.hijos : [];
  const padres = Array.isArray(d.padres) ? d.padres : [];

  medida.font = `30px ${F}`;
  const descTexto = limpiar(d.desc);
  const lineasDesc = descTexto ? envolver(medida, descTexto, 840, MAX_LINEAS_DESC) : [];
  const HH = 340;                                   // cabecera (foto, nombre, titulo)
  const DH = 70 + Math.max(1, lineasDesc.length) * 42 + 30; // recuadro de descripcion
  let altoFamilia = 84;                             // titulo de seccion
  altoFamilia += d.pareja ? 170 : 80;               // pareja o soltero
  if (hijos.length) altoFamilia += 50 + medirChips(hijos) * 60 + 14;
  if (padres.length) altoFamilia += 50 + medirChips(padres) * 60 + 14;
  altoFamilia += 10;
  const PAN = d.banner ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.07)'; // recuadros mas oscuros sobre foto
  const H = 40 + HH + 30 + DH + 30 + 150 + 30 + altoFamilia + 70;

  const lienzo = L.createCanvas(Math.round(W * ESCALA), Math.round(H * ESCALA));
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESCALA, ESCALA);

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

  // FONDO_BANNER: la foto del usuario cubre toda la tarjeta, con velo oscuro para leer el texto
  if (d.banner) {
    try {
      const fondoImg = await L.loadImage(d.banner);
      const esc = Math.max(W / fondoImg.width, H / fondoImg.height);
      const dw = fondoImg.width * esc; const dh = fondoImg.height * esc;
      ctx.drawImage(fondoImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const velo = ctx.createLinearGradient(0, 0, 0, H);
      velo.addColorStop(0, 'rgba(0,0,0,0.35)'); velo.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = velo; ctx.fillRect(0, 0, W, H);
    } catch (_) { /* si falla, queda el fondo del tema */ }
  }

  // Borde de la tarjeta
  rr(ctx, 14, 14, W - 28, H - 28, 34);
  ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1;

  // ===== Cabecera =====
  const py = 40;
  rr(ctx, 40, py, W - 80, HH, 28);
  ctx.fillStyle = PAN; ctx.fill();

  // Avatar con aro y brillo (mas grande)
  const ax = 210; const ay = py + HH / 2; const ar = 128;
  ctx.save();
  ctx.shadowColor = T.acento; ctx.shadowBlur = 40;
  trazarMarco(ctx, d.marco, ax, ay, ar + 10);
  const aro = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
  aro.addColorStop(0, T.suave); aro.addColorStop(1, T.acento);
  ctx.fillStyle = aro; ctx.fill();
  ctx.restore();
  trazarMarco(ctx, d.marco, ax, ay, ar + 3); ctx.fillStyle = T.a; ctx.fill();
  ctx.save();
  trazarMarco(ctx, d.marco, ax, ay, ar); ctx.clip();
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
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 140px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((limpiar(d.nombre).replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase(), ax, ay + 6);
  }
  ctx.restore();

  // Nombre, titulo, datos
  const tx = 400; const tw = W - tx - 60;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let tam = 68;
  ctx.font = `bold ${tam}px ${F}`;
  while (tam > 34 && ctx.measureText(limpiar(d.nombre)).width > tw) { tam -= 2; ctx.font = `bold ${tam}px ${F}`; }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  let y = py + 112;
  ctx.fillText(recortar(ctx, d.nombre, tw), tx, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  const titulo = limpiar(d.titulo);
  if (titulo) {
    ctx.font = `bold 28px ${F}`;
    const w = Math.min(ctx.measureText(titulo).width + 48, tw);
    y += 26;
    rr(ctx, tx, y, w, 52, 26);
    const gp = ctx.createLinearGradient(tx, 0, tx + w, 0); gp.addColorStop(0, T.acento); gp.addColorStop(1, T.suave);
    ctx.fillStyle = gp; ctx.fill();
    ctx.fillStyle = T.a; ctx.textBaseline = 'middle';
    ctx.fillText(recortar(ctx, titulo, w - 36), tx + 24, y + 27);
    ctx.textBaseline = 'alphabetic';
    y += 52;
  }
  y += 52;
  ctx.font = `26px ${F}`; ctx.fillStyle = T.suave;
  if (d.genero) { ctx.fillText(recortar(ctx, limpiar(d.genero), tw), tx, y); y += 40; }
  if (d.cumple) { ctx.fillText(recortar(ctx, 'Cumple: ' + limpiar(d.cumple), tw), tx, y); y += 40; }

  // ===== Descripcion (recuadro propio, letra grande, hasta 10 lineas) =====
  const dy = py + HH + 30;
  rr(ctx, 40, dy, W - 80, DH, 28);
  ctx.fillStyle = PAN; ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `bold 28px ${F}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('SOBRE MÍ', 80, dy + 46);
  const lind = ctx.createLinearGradient(255, 0, W - 70, 0); lind.addColorStop(0, T.acento); lind.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lind; ctx.fillRect(255, dy + 38, W - 70 - 255, 3);
  ctx.font = `30px ${F}`;
  let ty = dy + 100;
  if (lineasDesc.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const l of lineasDesc) { ctx.fillText(l, 80, ty); ty += 42; }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Sin descripción', 80, ty);
  }

  // ===== Estadisticas =====
  const sy = dy + DH + 30;
  const stats = [['SALDO', '$' + dinero(d.saldo)], ['BANCO', '$' + dinero(d.banco)], ['ADVERTENCIAS', String(d.warns || 0)]];
  const sw = (W - 80 - 40) / 3;
  stats.forEach((s, i) => {
    const x = 40 + i * (sw + 20);
    rr(ctx, x, sy, sw, 150, 26);
    ctx.fillStyle = PAN; ctx.fill();
    ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = `bold 23px ${F}`; ctx.fillStyle = T.suave; ctx.fillText(s[0], x + sw / 2, sy + 50);
    ctx.fillStyle = '#ffffff';
    let vt = 52; ctx.font = `bold ${vt}px ${F}`;
    while (vt > 26 && ctx.measureText(s[1]).width > sw - 36) { vt -= 2; ctx.font = `bold ${vt}px ${F}`; } // se achica para que quepa el numero completo
    const v = s[1];
    ctx.fillText(v, x + sw / 2, sy + 116);
  });

  // ===== Familia =====
  const fy = sy + 150 + 30;
  rr(ctx, 40, fy, W - 80, altoFamilia, 28);
  ctx.fillStyle = PAN; ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `bold 32px ${F}`; ctx.fillStyle = '#ffffff';
  ctx.fillText('FAMILIA', 80, fy + 52);
  const lin = ctx.createLinearGradient(240, 0, W - 70, 0); lin.addColorStop(0, T.acento); lin.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lin; ctx.fillRect(240, fy + 43, W - 70 - 240, 3);
  corazon(ctx, W - 100, fy + 46, 36, T.acento);
  let cy = fy + 84;

  if (d.pareja) {
    // Pareja
    rr(ctx, 70, cy, W - 140, 150, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
    corazon(ctx, 125, cy + 75, 60, T.acento);
    ctx.fillStyle = T.suave; ctx.font = `bold 22px ${F}`; ctx.fillText('CASADO/A CON', 190, cy + 44);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 40px ${F}`;
    ctx.fillText(recortar(ctx, d.pareja, 400), 190, cy + 94);
    if (d.boda) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `24px ${F}`;
      ctx.fillText('Boda: ' + limpiar(d.boda.fecha), 190, cy + 130);
      // Dias de casados (caja a la derecha)
      const bx = W - 70 - 270; rr(ctx, bx, cy + 16, 250, 118, 20);
      const gb = ctx.createLinearGradient(bx, cy, bx + 250, cy + 134); gb.addColorStop(0, T.acento); gb.addColorStop(1, T.suave);
      ctx.fillStyle = gb; ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = T.a;
      ctx.font = `bold 60px ${F}`; ctx.fillText(String(d.boda.dias), bx + 125, cy + 80);
      ctx.font = `bold 21px ${F}`; ctx.fillText(d.boda.dias === 1 ? 'DÍA DE CASADOS' : 'DÍAS DE CASADOS', bx + 125, cy + 112);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `23px ${F}`;
      ctx.fillText('Fecha de boda no registrada', 190, cy + 130);
    }
    cy += 170;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `30px ${F}`;
    ctx.fillText('Estado: Soltero/a', 80, cy + 40);
    cy += 80;
  }

  const filaChips = (tituloFila, lista) => {
    ctx.fillStyle = T.suave; ctx.font = `bold 24px ${F}`; ctx.textAlign = 'left';
    ctx.fillText(tituloFila, 80, cy + 26);
    cy += 50;
    let x = 80; ctx.font = `26px ${F}`;
    for (const nombre of lista) {
      const t = recortar(ctx, nombre, 380);
      const w = ctx.measureText(t).width + 52;
      if (x + w > 80 + chipsAncho) { x = 80; cy += 60; }
      rr(ctx, x, cy, w, 48, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x + 24, cy + 24, 6, 0, Math.PI * 2); ctx.fillStyle = T.acento; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 38, cy + 25); ctx.textBaseline = 'alphabetic';
      x += w + 12;
    }
    cy += 60 + 14;
  };
  if (hijos.length) filaChips(`HIJOS (${hijos.length})`, hijos);
  if (padres.length) filaChips('PADRES', padres);

  // Pie
  ctx.textAlign = 'center'; ctx.font = `22px ${F}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('ALEPANDA-BOT  ·  .editarperfil para personalizar', W / 2, H - 32);
  return lienzo;
}

async function crearPerfil(d) {
  const lienzo = await dibujarPerfil(d);
  return lienzo.toBuffer('image/png');
}

module.exports = { crearPerfil, dibujarPerfil, TEMAS, MARCOS };

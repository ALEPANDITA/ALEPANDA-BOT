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

// Tamaños de la tarjeta: mientras mas angosto es el lienzo, mas grandes se ven las letras en el chat.
// "grande" (por defecto) se ve casi al doble que la tarjeta anterior; cada persona puede elegir con .editarperfil letras
const TAMANOS = { normal: 720, grande: 520, enorme: 430 };
const MAX_LINEAS_DESC = 12;

// Acomoda los chips en filas (sirve para medir la altura y para dibujarlos igual)
function disponerChips(ctx, lista, ancho) {
  ctx.font = `23px ${F}`;
  const items = []; let x = 0; let fila = 0;
  for (const nombre of lista) {
    const t = recortar(ctx, nombre, Math.min(330, ancho - 52));
    const w = ctx.measureText(t).width + 52;
    if (x > 0 && x + w > ancho) { x = 0; fila++; }
    items.push({ t, x, fila, w });
    x += w + 10;
  }
  return { items, filas: lista.length ? fila + 1 : 0 };
}

// d = { nombre, titulo, desc, genero, cumple, tema, tamano, marco, avatar(Buffer|null), banner(Buffer|null), saldo, banco, warns,
//       pareja: nombre|null, boda: { fecha, dias }|null, hijos: [nombres], padres: [nombres] }
async function dibujarPerfil(d) {
  const L = cargarCanvas();
  const T = TEMAS[d.tema] || TEMAS.rosa;
  const W = TAMANOS[d.tamano] || TAMANOS.grande;
  const ESC = Math.min(3, 1200 / W); // pixeles reales por unidad del dibujo (nitidez)
  const PAN = d.banner ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.07)'; // recuadros mas oscuros sobre foto
  const hijos = Array.isArray(d.hijos) ? d.hijos : [];
  const padres = Array.isArray(d.padres) ? d.padres : [];

  let avatarImg = null; let bannerImg = null;
  if (d.avatar) { try { avatarImg = await L.loadImage(d.avatar); } catch (_) { avatarImg = null; } }
  if (d.banner) { try { bannerImg = await L.loadImage(d.banner); } catch (_) { bannerImg = null; } }

  // Dibuja toda la tarjeta y devuelve el alto que ocupa. Se corre una vez para medir y otra para dibujar de verdad.
  const pintar = (ctx, H) => {
    const pad = Math.round(W * 0.042);
    const pw = W - pad * 2;      // ancho de cada recuadro
    const ix = pad + 22;         // x interior izquierdo
    const iw = pw - 44;          // ancho interior
    const centro = W / 2;

    // ----- fondo -----
    const fondo = ctx.createLinearGradient(0, 0, W, H);
    fondo.addColorStop(0, T.a); fondo.addColorStop(1, T.b);
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.10; ctx.fillStyle = T.acento;
    ctx.beginPath(); ctx.arc(W - 40, 40, W * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.07;
    ctx.beginPath(); ctx.arc(30, H - 20, W * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffffff';
    for (let yy = 16; yy < H; yy += 28) for (let xx = 16 + ((yy / 28) % 2) * 14; xx < W; xx += 28) { ctx.beginPath(); ctx.arc(xx, yy, 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (bannerImg) { // la foto del usuario cubre toda la tarjeta, con velo oscuro para leer el texto
      const esc = Math.max(W / bannerImg.width, H / bannerImg.height);
      const dw = bannerImg.width * esc; const dh = bannerImg.height * esc;
      ctx.drawImage(bannerImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const velo = ctx.createLinearGradient(0, 0, 0, H);
      velo.addColorStop(0, 'rgba(0,0,0,0.35)'); velo.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = velo; ctx.fillRect(0, 0, W, H);
    }
    rr(ctx, 8, 8, W - 16, H - 16, 28);
    ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;

    let y = pad + 6;

    // ===== Cabecera: foto arriba al centro, luego nombre y datos =====
    const ar = Math.round(W * 0.15);
    const nombre = limpiar(d.nombre) || 'Sin nombre';
    let tam = 46; ctx.font = `bold ${tam}px ${F}`;
    while (tam > 24 && ctx.measureText(nombre).width > iw) { tam -= 2; ctx.font = `bold ${tam}px ${F}`; }
    const titulo = limpiar(d.titulo);
    const datos = [];
    if (d.genero) datos.push(limpiar(d.genero));
    if (d.cumple) datos.push('Cumple: ' + limpiar(d.cumple));
    let hh = 26 + (ar + 10) * 2 + 18 + Math.round(tam * 1.0);
    if (titulo) hh += 14 + 46;
    if (datos.length) hh += 10 + datos.length * 34;
    hh += 22;
    rr(ctx, pad, y, pw, hh, 26); ctx.fillStyle = PAN; ctx.fill();

    const ax = centro; const ay = y + 26 + ar + 10;
    ctx.save();
    ctx.shadowColor = T.acento; ctx.shadowBlur = 30;
    trazarMarco(ctx, d.marco, ax, ay, ar + 9);
    const aro = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
    aro.addColorStop(0, T.suave); aro.addColorStop(1, T.acento);
    ctx.fillStyle = aro; ctx.fill();
    ctx.restore();
    trazarMarco(ctx, d.marco, ax, ay, ar + 3); ctx.fillStyle = T.a; ctx.fill();
    ctx.save();
    trazarMarco(ctx, d.marco, ax, ay, ar); ctx.clip();
    if (avatarImg) {
      const lado = Math.min(avatarImg.width, avatarImg.height);
      ctx.drawImage(avatarImg, (avatarImg.width - lado) / 2, (avatarImg.height - lado) / 2, lado, lado, ax - ar, ay - ar, ar * 2, ar * 2);
    } else {
      const g = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      g.addColorStop(0, T.acento); g.addColorStop(1, T.b);
      ctx.fillStyle = g; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(ar * 1.1)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((nombre.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase(), ax, ay + 4);
    }
    ctx.restore();

    let cy = ay + ar + 10 + 18 + Math.round(tam * 0.82);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${tam}px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillText(recortar(ctx, nombre, iw), centro, cy);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    cy += Math.round(tam * 0.18);
    if (titulo) {
      ctx.font = `bold 24px ${F}`;
      const w = Math.min(ctx.measureText(titulo).width + 44, iw);
      cy += 14;
      rr(ctx, centro - w / 2, cy, w, 46, 23);
      const gp = ctx.createLinearGradient(centro - w / 2, 0, centro + w / 2, 0); gp.addColorStop(0, T.acento); gp.addColorStop(1, T.suave);
      ctx.fillStyle = gp; ctx.fill();
      ctx.fillStyle = T.a; ctx.textBaseline = 'middle';
      ctx.fillText(recortar(ctx, titulo, w - 30), centro, cy + 24);
      ctx.textBaseline = 'alphabetic';
      cy += 46;
    }
    if (datos.length) {
      cy += 10;
      ctx.font = `22px ${F}`; ctx.fillStyle = T.suave;
      for (const linea of datos) { cy += 34; ctx.fillText(recortar(ctx, linea, iw), centro, cy - 8); }
    }
    y += hh + 16;

    // ===== Descripcion (recuadro propio, hasta MAX_LINEAS_DESC lineas) =====
    ctx.font = `26px ${F}`;
    const descTexto = limpiar(d.desc);
    const lineasDesc = descTexto ? envolver(ctx, descTexto, iw, MAX_LINEAS_DESC) : [];
    const dh = 84 + (Math.max(1, lineasDesc.length) - 1) * 36 + 34;
    rr(ctx, pad, y, pw, dh, 26); ctx.fillStyle = PAN; ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 24px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('SOBRE MÍ', ix, y + 42);
    const lx = ix + ctx.measureText('SOBRE MÍ').width + 14;
    const lind = ctx.createLinearGradient(lx, 0, ix + iw, 0); lind.addColorStop(0, T.acento); lind.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lind; ctx.fillRect(lx, y + 33, ix + iw - lx, 3);
    ctx.font = `26px ${F}`;
    let ty = y + 86;
    if (lineasDesc.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.93)';
      for (const l of lineasDesc) { ctx.fillText(l, ix, ty); ty += 36; }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('Sin descripción', ix, ty);
    }
    y += dh + 16;

    // ===== Estadisticas =====
    const cw = (pw - 14) / 2;
    [['SALDO', '$' + dinero(d.saldo)], ['BANCO', '$' + dinero(d.banco)]].forEach((s, i) => {
      const x = pad + i * (cw + 14);
      rr(ctx, x, y, cw, 112, 22); ctx.fillStyle = PAN; ctx.fill();
      ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = `bold 20px ${F}`; ctx.fillStyle = T.suave; ctx.fillText(s[0], x + cw / 2, y + 36);
      let vt = 42; ctx.font = `bold ${vt}px ${F}`;
      while (vt > 20 && ctx.measureText(s[1]).width > cw - 26) { vt -= 2; ctx.font = `bold ${vt}px ${F}`; } // se achica para que quepa el numero completo
      ctx.fillStyle = '#ffffff'; ctx.fillText(s[1], x + cw / 2, y + 88);
    });
    y += 112 + 14;
    rr(ctx, pad, y, pw, 76, 22); ctx.fillStyle = PAN; ctx.fill();
    ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.font = `bold 22px ${F}`; ctx.fillStyle = T.suave; ctx.fillText('ADVERTENCIAS', ix, y + 47);
    ctx.textAlign = 'right'; ctx.font = `bold 40px ${F}`; ctx.fillStyle = '#ffffff'; ctx.fillText(String(d.warns || 0), ix + iw, y + 51);
    y += 76 + 16;

    // ===== Familia =====
    const grupos = [];
    if (hijos.length) grupos.push([`HIJOS (${hijos.length})`, hijos]);
    if (padres.length) grupos.push([`PADRES`, padres]);
    const dispuestos = grupos.map(([t, lista]) => ({ t, ...disponerChips(ctx, lista, iw) }));
    let fh = 70;
    fh += d.pareja ? 112 + (d.boda ? 12 + 84 : 0) + 14 : 56;
    for (const g of dispuestos) fh += 40 + g.filas * 52 + 10;
    fh += 12;
    rr(ctx, pad, y, pw, fh, 26); ctx.fillStyle = PAN; ctx.fill();
    ctx.textAlign = 'left'; ctx.font = `bold 28px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('FAMILIA', ix, y + 46);
    const fx = ix + ctx.measureText('FAMILIA').width + 14;
    const lin = ctx.createLinearGradient(fx, 0, ix + iw - 50, 0); lin.addColorStop(0, T.acento); lin.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lin; ctx.fillRect(fx, y + 37, ix + iw - 50 - fx, 3);
    corazon(ctx, ix + iw - 18, y + 36, 34, T.acento);
    let fy = y + 70;

    if (d.pareja) {
      const bx = pad + 14; const bw = pw - 28;
      rr(ctx, bx, fy, bw, 112, 22); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      corazon(ctx, bx + 46, fy + 56, 54, T.acento);
      const nx = bx + 92;
      ctx.textAlign = 'left'; ctx.fillStyle = T.suave; ctx.font = `bold 17px ${F}`; ctx.fillText('CASADO/A CON', nx, fy + 32);
      let pt = 32; ctx.font = `bold ${pt}px ${F}`;
      while (pt > 20 && ctx.measureText(limpiar(d.pareja)).width > bw - 92 - 16) { pt -= 2; ctx.font = `bold ${pt}px ${F}`; }
      ctx.fillStyle = '#ffffff'; ctx.fillText(recortar(ctx, d.pareja, bw - 92 - 16), nx, fy + 70);
      const textoBoda = d.boda ? 'Boda: ' + limpiar(d.boda.fecha) : 'Fecha de boda no registrada';
      let bt = 20; ctx.font = `${bt}px ${F}`;
      while (bt > 13 && ctx.measureText(textoBoda).width > bw - 92 - 16) { bt -= 1; ctx.font = `${bt}px ${F}`; }
      ctx.fillStyle = d.boda ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'; ctx.fillText(textoBoda, nx, fy + 99);
      fy += 112;
      if (d.boda) {
        fy += 12;
        rr(ctx, bx, fy, bw, 84, 22);
        const gb = ctx.createLinearGradient(bx, fy, bx + bw, fy + 84); gb.addColorStop(0, T.acento); gb.addColorStop(1, T.suave);
        ctx.fillStyle = gb; ctx.fill();
        const num = String(d.boda.dias); const lab = d.boda.dias === 1 ? 'DÍA DE CASADOS' : 'DÍAS DE CASADOS';
        ctx.font = `bold 50px ${F}`; const wn = ctx.measureText(num).width;
        ctx.font = `bold 20px ${F}`; const wl = ctx.measureText(lab).width;
        const x0 = bx + (bw - (wn + 14 + wl)) / 2;
        ctx.textAlign = 'left'; ctx.fillStyle = T.a;
        ctx.font = `bold 50px ${F}`; ctx.fillText(num, x0, fy + 58);
        ctx.font = `bold 20px ${F}`; ctx.fillText(lab, x0 + wn + 14, fy + 56);
        fy += 84;
      }
      fy += 14;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `26px ${F}`; ctx.textAlign = 'left';
      ctx.fillText('Estado: Soltero/a', ix, fy + 28);
      fy += 56;
    }
    for (const g of dispuestos) {
      ctx.fillStyle = T.suave; ctx.font = `bold 21px ${F}`; ctx.textAlign = 'left';
      ctx.fillText(g.t, ix, fy + 24);
      fy += 40;
      ctx.font = `23px ${F}`;
      for (const c of g.items) {
        const cx0 = ix + c.x; const cyy = fy + c.fila * 52;
        rr(ctx, cx0, cyy, c.w, 42, 21);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
        ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx0 + 20, cyy + 21, 5, 0, Math.PI * 2); ctx.fillStyle = T.acento; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(c.t, cx0 + 34, cyy + 22); ctx.textBaseline = 'alphabetic';
      }
      fy += g.filas * 52 + 10;
    }
    y += fh + 14;

    // Pie
    let pf = 18; const pie = 'ALEPANDA-BOT  ·  .editarperfil para personalizar';
    ctx.font = `${pf}px ${F}`;
    while (pf > 11 && ctx.measureText(pie).width > pw) { pf -= 1; ctx.font = `${pf}px ${F}`; }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(pie, centro, y + 20);
    return y + 40;
  };

  const alto = Math.ceil(pintar(L.createCanvas(W, 100).getContext('2d'), 100));
  const lienzo = L.createCanvas(Math.round(W * ESC), Math.round(alto * ESC));
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESC, ESC);
  pintar(ctx, alto);
  return lienzo;
}

async function crearPerfil(d) {
  const lienzo = await dibujarPerfil(d);
  return lienzo.toBuffer('image/png');
}

module.exports = { crearPerfil, dibujarPerfil, TEMAS, MARCOS, TAMANOS };

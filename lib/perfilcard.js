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

// ----- Tamaño de la tarjeta -----
// La tarjeta se dibuja a lo ANCHO que dice "tamano" (mas angosta = letras mas grandes en el chat) y su alto nunca pasa de
// REL_MAX veces el ancho. WhatsApp recorta las imagenes muy altas en el chat (hay que tocarlas para verlas completas);
// con 1.3 (casi 3:4, como una foto vertical) se ve COMPLETA. Si el contenido no cabe, la tarjeta se ensancha un poco
// (las letras se achican lo justo) en vez de crecer hacia abajo. Si en tu WhatsApp aun se recorta, baja REL_MAX (ej. 1.2).
const TAMANOS = { normal: 600, grande: 520, enorme: 450 };
const REL_MAX = 1.3;
const ANCHO_MAX = 860;
const ESCALA_LETRAS = 1.3;  // PARCHE-ANCHO2: letras y numeros 30% mas grandes (sube o baja a tu gusto)
const FOTO_ESCALA = 1.25;   // la foto de perfil 25% mas grande
const ANCHO_CASADOS = 1.6; // la tarjeta de casados es 1.6 veces mas ancha (el alto casi no cambia)
const MAX_LINEAS_DESC = 5;
const MAX_HIJOS_VISTOS = 6;
const MAX_PADRES_VISTOS = 4;

// Acomoda los chips en filas (sirve para medir la altura y para dibujarlos igual)
function disponerChips(ctx, lista, ancho) {
  ctx.font = `21px ${F}`;
  const items = []; let x = 0; let fila = 0;
  for (const nombre of lista) {
    const t = recortar(ctx, nombre, Math.min(300, ancho - 48));
    const w = ctx.measureText(t).width + 48;
    if (x > 0 && x + w > ancho) { x = 0; fila++; }
    items.push({ t, x, fila, w });
    x += w + 8;
  }
  return { items, filas: lista.length ? fila + 1 : 0 };
}

// Fondo con la foto del usuario: se ve COMPLETA (sin recortarla). Si su forma se parece a la de la tarjeta la cubre; si no,
// va completa al centro sobre una copia borrosa de ella misma que rellena los lados. Encima va un velo oscuro para leer el texto.
function pintarBanner(L, ctx, img, W, H) {
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const rTarjeta = W / H; const rImg = img.width / img.height;
  if (Math.abs(rImg - rTarjeta) / rTarjeta <= 0.15) {
    const esc = Math.max(W / img.width, H / img.height);
    const dw = img.width * esc; const dh = img.height * esc;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const mw = 28; const mh = Math.max(8, Math.round(28 * H / W));
    const mini = L.createCanvas(mw, mh); const mctx = mini.getContext('2d');
    mctx.imageSmoothingEnabled = true; mctx.imageSmoothingQuality = 'high';
    const em = Math.max(mw / img.width, mh / img.height);
    mctx.drawImage(img, (mw - img.width * em) / 2, (mh - img.height * em) / 2, img.width * em, img.height * em);
    ctx.drawImage(mini, 0, 0, W, H);                       // copia borrosa de relleno
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
    const esc = Math.min(W / img.width, H / img.height);   // la foto completa, sin cortar
    const dw = img.width * esc; const dh = img.height * esc;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  const velo = ctx.createLinearGradient(0, 0, 0, H);
  velo.addColorStop(0, 'rgba(0,0,0,0.35)'); velo.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = velo; ctx.fillRect(0, 0, W, H);
}

// d = { nombre, titulo, desc, genero, cumple, tema, tamano, marco, avatar(Buffer|null), banner(Buffer|null), saldo, banco, warns,
//       pareja: nombre|null, boda: { fecha, dias }|null, hijos: [nombres], padres: [nombres] }
async function dibujarPerfil(d) {
  const L = cargarCanvas();
  const T = TEMAS[d.tema] || TEMAS.rosa;
  const PAN = d.banner ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.07)'; // recuadros mas oscuros sobre foto
  const hijosTodos = Array.isArray(d.hijos) ? d.hijos : [];
  const padresTodos = Array.isArray(d.padres) ? d.padres : [];
  const verHijos = hijosTodos.length > MAX_HIJOS_VISTOS ? [...hijosTodos.slice(0, MAX_HIJOS_VISTOS - 1), `+${hijosTodos.length - (MAX_HIJOS_VISTOS - 1)} más`] : hijosTodos;
  const verPadres = padresTodos.length > MAX_PADRES_VISTOS ? padresTodos.slice(0, MAX_PADRES_VISTOS) : padresTodos;

  let avatarImg = null; let bannerImg = null;
  if (d.avatar) { try { avatarImg = await L.loadImage(d.avatar); } catch (_) { avatarImg = null; } }
  if (d.banner) { try { bannerImg = await L.loadImage(d.banner); } catch (_) { bannerImg = null; } }
  // PARCHE-CASADOS: tarjeta ancha con la foto de tu pareja
  const dos = !!(d.casados && d.pareja);
  let parejaImg = null;
  if (dos && d.casados.avatar) { try { parejaImg = await L.loadImage(d.casados.avatar); } catch (_) { parejaImg = null; } }
  const nombre2 = dos ? (limpiar(d.casados.nombre) || 'Pareja') : '';

  // Dibuja toda la tarjeta de ancho W y devuelve el alto que ocupa. Se corre una vez para medir (real = false) y otra para dibujar.
  const pintar = (ctx, W, H, real) => {
    const pad = Math.round(W * 0.045);
    const pw = W - pad * 2;      // ancho de cada recuadro
    const ix = pad + 20;         // x interior izquierdo
    const iw = pw - 40;          // ancho interior
    const gap = 12;

    // ----- fondo -----
    if (real) {
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
      if (bannerImg) pintarBanner(L, ctx, bannerImg, W, H);
      rr(ctx, 8, 8, W - 16, H - 16, 28);
      ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    }

    let y = pad;

    // ===== Cabecera: foto a la izquierda; nombre, titulo y datos a la derecha =====
    // fototam: chica = foto pequeña al lado del nombre; grande/enorme = foto grande centrada arriba (PARCHE-FOTO)
    const apilado = d.fotoTam !== 'chica' || dos;
    const Wb = W / ANCHO_CASADOS; // el tamano de las fotos es el de siempre aunque la tarjeta sea mas ancha
    const ar = apilado ? Math.round(Wb * FOTO_ESCALA * (d.fotoTam === 'enorme' ? 0.27 : 0.2)) : 54;
    const sep = Math.round(W * 0.24); const xA = W / 2 - sep; const xB = W / 2 + sep;
    const nombre = limpiar(d.nombre) || 'Sin nombre';
    const tx = apilado ? W / 2 : pad + 20 + (ar + 8) * 2 + 18;   // x donde empieza el texto (o su centro)
    const tw = apilado ? pw - 40 : pad + pw - 18 - tx;           // ancho disponible para el texto
    let tam = 40; ctx.font = `bold ${tam}px ${F}`;
    const twNombre = dos ? 2 * sep - 24 : tw;
    while (tam > 22 && Math.max(ctx.measureText(nombre).width, dos ? ctx.measureText(nombre2).width : 0) > twNombre) { tam -= 2; ctx.font = `bold ${tam}px ${F}`; }
    const titulo = limpiar(d.titulo);
    const datos = [];
    if (d.genero) datos.push(limpiar(d.genero));
    if (d.cumple) datos.push('Cumple: ' + limpiar(d.cumple));
    ctx.font = `20px ${F}`;
    let lineasDatos = datos;
    const unidos = datos.join('  ·  ');
    if (datos.length > 1 && ctx.measureText(unidos).width <= tw) lineasDatos = [unidos];
    const bloqueTexto = (dos ? 10 : 0) + 18 + Math.round(tam * 1.15) + (titulo ? 10 + 36 : 0) + (lineasDatos.length ? 6 + lineasDatos.length * 28 : 0) + 14;
    const hh = apilado ? (22 + 2 * (ar + 8) - 4) + bloqueTexto : Math.max(2 * ar + 56, bloqueTexto);
    rr(ctx, pad, y, pw, hh, 26); ctx.fillStyle = PAN; ctx.fill();

    // PARCHE-CASADOS: una foto (o dos, si es tarjeta de casados)
    const dibujarFoto = (fx, fy, img, nombreFoto) => {
      ctx.save();
      ctx.shadowColor = T.acento; ctx.shadowBlur = 24;
      trazarMarco(ctx, d.marco, fx, fy, ar + 8);
      const aro = ctx.createLinearGradient(fx - ar, fy - ar, fx + ar, fy + ar);
      aro.addColorStop(0, T.suave); aro.addColorStop(1, T.acento);
      ctx.fillStyle = aro; ctx.fill();
      ctx.restore();
      trazarMarco(ctx, d.marco, fx, fy, ar + 3); ctx.fillStyle = T.a; ctx.fill();
      ctx.save();
      trazarMarco(ctx, d.marco, fx, fy, ar); ctx.clip();
      if (img) {
        const lado = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, fx - ar, fy - ar, ar * 2, ar * 2);
      } else {
        const g = ctx.createLinearGradient(fx - ar, fy - ar, fx + ar, fy + ar);
        g.addColorStop(0, T.acento); g.addColorStop(1, T.b);
        ctx.fillStyle = g; ctx.fillRect(fx - ar, fy - ar, ar * 2, ar * 2);
        ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(ar * 1.1)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((String(nombreFoto).replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase(), fx, fy + 4);
      }
      ctx.restore();
    };
    const ay = apilado ? y + 22 + ar + 8 : y + hh / 2;
    if (dos) {
      dibujarFoto(xA, ay, avatarImg, nombre);
      dibujarFoto(xB, ay, parejaImg, nombre2);
      ctx.save(); ctx.shadowColor = T.acento; ctx.shadowBlur = 22;
      corazon(ctx, W / 2, ay, 56, T.acento);
      ctx.restore();
    } else {
      dibujarFoto(apilado ? W / 2 : pad + 20 + ar + 8, ay, avatarImg, nombre);
    }

    let cy = apilado ? y + (22 + 2 * (ar + 8) - 4) + 18 + Math.round(tam * 0.85) : y + (hh - bloqueTexto) / 2 + 18 + Math.round(tam * 0.85);
    ctx.textAlign = apilado ? 'center' : 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${tam}px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    if (dos) { ctx.fillText(recortar(ctx, nombre, twNombre), xA, cy); ctx.fillText(recortar(ctx, nombre2, twNombre), xB, cy); } else ctx.fillText(recortar(ctx, nombre, tw), tx, cy);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    cy += Math.round(tam * 0.3) + (dos ? 10 : 0);
    if (titulo) {
      ctx.font = `bold 20px ${F}`;
      const w = Math.min(ctx.measureText(titulo).width + 36, tw);
      const px0 = apilado ? tx - w / 2 : tx;
      rr(ctx, px0, cy, w, 36, 18);
      const gp = ctx.createLinearGradient(px0, 0, px0 + w, 0); gp.addColorStop(0, T.acento); gp.addColorStop(1, T.suave);
      ctx.fillStyle = gp; ctx.fill();
      ctx.fillStyle = T.a; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(recortar(ctx, titulo, w - 24), px0 + 18, cy + 19);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = apilado ? 'center' : 'left';
      cy += 36 + 10;
    }
    if (lineasDatos.length) {
      ctx.font = `20px ${F}`; ctx.fillStyle = T.suave;
      for (const linea of lineasDatos) { cy += 28; ctx.fillText(recortar(ctx, linea, tw), tx, cy - 6); }
    }
    y += hh + gap;

    // ===== Estadisticas en una sola fila: saldo, banco y advertencias =====
    const libre = pw - gap * 2;
    const wDinero = Math.floor((pw - gap) / 2);
    const anchos = [wDinero, wDinero];
    const cajas = [['SALDO', '$' + dinero(d.saldo)], ['BANCO', '$' + dinero(d.banco)]];
    let sx = pad;
    cajas.forEach((s, i) => {
      const cw = anchos[i];
      rr(ctx, sx, y, cw, 96, 22); ctx.fillStyle = PAN; ctx.fill();
      ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = `bold 17px ${F}`; ctx.fillStyle = T.suave; ctx.fillText(s[0], sx + cw / 2, y + 30);
      let vt = 46; ctx.font = `bold ${vt}px ${F}`;
      while (vt > 18 && ctx.measureText(s[1]).width > cw - 20) { vt -= 2; ctx.font = `bold ${vt}px ${F}`; } // se achica para que quepa el numero completo
      ctx.fillStyle = '#ffffff'; ctx.fillText(s[1], sx + cw / 2, y + 76);
      sx += cw + gap;
    });
    y += 96 + gap;

    // ===== Descripcion =====
    ctx.font = `24px ${F}`;
    const descTexto = limpiar(d.desc);
    const lineasDesc = descTexto ? envolver(ctx, descTexto, iw, MAX_LINEAS_DESC) : [];
    const dh = 50 + Math.max(1, lineasDesc.length) * 32;
    rr(ctx, pad, y, pw, dh, 24); ctx.fillStyle = PAN; ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 21px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('SOBRE MÍ', ix, y + 34);
    const lx = ix + ctx.measureText('SOBRE MÍ').width + 12;
    const textoWarns = 'WARNS ' + String(d.warns || 0);
    ctx.font = `bold 18px ${F}`; const anchoWarns = ctx.measureText(textoWarns).width;
    const finLinea = ix + iw - anchoWarns - 14;
    const lind = ctx.createLinearGradient(lx, 0, finLinea, 0); lind.addColorStop(0, T.acento); lind.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lind; ctx.fillRect(lx, y + 26, Math.max(0, finLinea - lx), 3);
    ctx.textAlign = 'right'; ctx.fillStyle = (d.warns || 0) > 0 ? '#ffb4b4' : T.suave; ctx.fillText(textoWarns, ix + iw, y + 34); ctx.textAlign = 'left';
    ctx.font = `24px ${F}`;
    let ty = y + 72;
    if (lineasDesc.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.93)';
      for (const l of lineasDesc) { ctx.fillText(l, ix, ty); ty += 32; }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('Sin descripción', ix, ty);
    }
    y += dh + gap;

    // ===== Familia =====
    const grupos = [];
    if (verHijos.length) grupos.push([`HIJOS (${hijosTodos.length})`, verHijos]);
    if (verPadres.length) grupos.push([`PADRES`, verPadres]);
    const dispuestos = grupos.map(([t, lista]) => ({ t, ...disponerChips(ctx, lista, iw) }));
    let fh = 58;
    fh += d.pareja ? 84 + 10 : 38;
    for (const g of dispuestos) fh += 32 + g.filas * 46 + 6;
    fh += 10;
    rr(ctx, pad, y, pw, fh, 24); ctx.fillStyle = PAN; ctx.fill();
    ctx.textAlign = 'left'; ctx.font = `bold 24px ${F}`; ctx.fillStyle = '#ffffff';
    ctx.fillText('FAMILIA', ix, y + 38);
    const fx = ix + ctx.measureText('FAMILIA').width + 12;
    const lin = ctx.createLinearGradient(fx, 0, ix + iw - 44, 0); lin.addColorStop(0, T.acento); lin.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lin; ctx.fillRect(fx, y + 29, ix + iw - 44 - fx, 3);
    corazon(ctx, ix + iw - 16, y + 28, 30, T.acento);
    let fy = y + 58;

    if (d.pareja) {
      const bx = pad + 12; const bw = pw - 24;
      rr(ctx, bx, fy, bw, 84, 20); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      corazon(ctx, bx + 38, fy + 42, 46, T.acento);
      const nx = bx + 76;
      const anchoDias = d.boda ? 104 : 0;
      const anchoNombre = bw - 76 - anchoDias - 14;
      ctx.textAlign = 'left'; ctx.fillStyle = T.suave; ctx.font = `bold 15px ${F}`; ctx.fillText('CASADO/A CON', nx, fy + 25);
      let pt = 28; ctx.font = `bold ${pt}px ${F}`;
      while (pt > 18 && ctx.measureText(limpiar(d.pareja)).width > anchoNombre) { pt -= 2; ctx.font = `bold ${pt}px ${F}`; }
      ctx.fillStyle = '#ffffff'; ctx.fillText(recortar(ctx, d.pareja, anchoNombre), nx, fy + 54);
      const textoBoda = d.boda ? 'Boda: ' + limpiar(d.boda.fecha) : 'Fecha de boda no registrada';
      let bt = 17; ctx.font = `${bt}px ${F}`;
      while (bt > 12 && ctx.measureText(textoBoda).width > anchoNombre) { bt -= 1; ctx.font = `${bt}px ${F}`; }
      ctx.fillStyle = d.boda ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'; ctx.fillText(recortar(ctx, textoBoda, anchoNombre), nx, fy + 76);
      if (d.boda) {
        const px = bx + bw - anchoDias - 8; const pyy = fy + 10;
        rr(ctx, px, pyy, anchoDias, 64, 18);
        const gb = ctx.createLinearGradient(px, pyy, px + anchoDias, pyy + 64); gb.addColorStop(0, T.acento); gb.addColorStop(1, T.suave);
        ctx.fillStyle = gb; ctx.fill();
        const numero = String(d.boda.dias);
        let nt = 34; ctx.font = `bold ${nt}px ${F}`;
        while (nt > 18 && ctx.measureText(numero).width > anchoDias - 16) { nt -= 2; ctx.font = `bold ${nt}px ${F}`; }
        ctx.textAlign = 'center'; ctx.fillStyle = T.a;
        ctx.fillText(numero, px + anchoDias / 2, pyy + 38);
        ctx.font = `bold 13px ${F}`; ctx.fillText(d.boda.dias === 1 ? 'DÍA' : 'DÍAS', px + anchoDias / 2, pyy + 56);
        ctx.textAlign = 'left';
      }
      fy += 84 + 10;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `24px ${F}`; ctx.textAlign = 'left';
      ctx.fillText('Estado: Soltero/a', ix, fy + 24);
      fy += 38;
    }
    for (const g of dispuestos) {
      ctx.fillStyle = T.suave; ctx.font = `bold 18px ${F}`; ctx.textAlign = 'left';
      ctx.fillText(g.t, ix, fy + 20);
      fy += 32;
      ctx.font = `21px ${F}`;
      for (const c of g.items) {
        const cx0 = ix + c.x; const cyy = fy + c.fila * 46;
        rr(ctx, cx0, cyy, c.w, 38, 19);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
        ctx.strokeStyle = T.acento; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx0 + 18, cyy + 19, 5, 0, Math.PI * 2); ctx.fillStyle = T.acento; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(c.t, cx0 + 31, cyy + 20); ctx.textBaseline = 'alphabetic';
      }
      fy += g.filas * 46 + 6;
    }
    y += fh + 10;

    // Pie
    let pf = 16; const pie = 'ALEPANDA-BOT  ·  .editarperfil para personalizar';
    ctx.font = `${pf}px ${F}`;
    while (pf > 11 && ctx.measureText(pie).width > pw) { pf -= 1; ctx.font = `${pf}px ${F}`; }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(pie, W / 2, y + 16);
    return y + 32;
  };

  // Mide con el ancho pedido; si queda mas alto que REL_MAX veces el ancho, se ensancha de a poco (las letras se achican lo justo)
  const medir = (ancho) => Math.ceil(pintar(L.createCanvas(ancho, 100).getContext('2d'), ancho, 100, false));
  let W = Math.round((TAMANOS[d.tamano] || TAMANOS.grande) * ANCHO_CASADOS / ESCALA_LETRAS);
  let alto = medir(W);
  // PARCHE-LETRAS: con foto grande/enorme no se ensancha, asi las letras quedan del mismo tamano que antes
  while (d.fotoTam === 'chica' && alto > W * REL_MAX && W < ANCHO_MAX) { W += 30; alto = medir(W); }

  const ESC = Math.min(3, 1200 / (W * ESCALA_LETRAS)) * ESCALA_LETRAS; // pixeles reales por unidad del dibujo (nitidez)
  const lienzo = L.createCanvas(Math.round(W * ESC), Math.round(alto * ESC));
  const ctx = lienzo.getContext('2d');
  ctx.scale(ESC, ESC);
  pintar(ctx, W, alto, true);
  return lienzo;
}

async function crearPerfil(d) {
  const lienzo = await dibujarPerfil(d);
  return lienzo.toBuffer('image/png');
}

module.exports = { crearPerfil, dibujarPerfil, TEMAS, MARCOS, TAMANOS };

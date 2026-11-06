// Dibuja la "cita" de .qc (avatar + nombre + texto en una burbuja) como PNG, SIN depender de ninguna API externa.
// Usa @napi-rs/canvas (trae sus binarios, no necesita instalar nada en el sistema) y las fuentes DejaVu de
// assets/fonts (van en el repo: un servidor sin fuentes instaladas igual dibuja bien el texto).
const path = require('path');
const fs = require('fs');

const CARPETA_FUENTES = path.join(__dirname, '..', 'assets', 'fonts');
const FAMILIA = 'QCSans';
const COLORES_NOMBRE = ['#ff516a', '#ff885e', '#ffcd6a', '#82de88', '#4dcdff', '#6c9bff', '#c88bff', '#ff7aaf'];
const COLORES_AVATAR = ['#d9534f', '#e67e22', '#d4a017', '#2e9e5b', '#1f8fb8', '#3b6fd8', '#8e5bd1', '#c2457f'];

let lib = null;
let hayEmoji = false;

function cargarCanvas() {
  if (lib) return lib;
  lib = require('@napi-rs/canvas'); // si no esta instalado, lanza un error claro (npm install)
  for (const archivo of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
    const ruta = path.join(CARPETA_FUENTES, archivo);
    if (fs.existsSync(ruta)) lib.GlobalFonts.registerFromPath(ruta, FAMILIA);
  }
  try { hayEmoji = lib.GlobalFonts.families.some((f) => /emoji/i.test(f.family)); } catch (_) { hayEmoji = false; }
  return lib;
}

const hash = (s) => [...String(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// Sin una fuente de emojis en el sistema, un emoji saldria como cuadrito: mejor quitarlo
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu;
function prepararTexto(t, multilinea) {
  let s = String(t || '').replace(/\r/g, '');
  if (!hayEmoji) s = s.replace(EMOJI, '');
  s = multilinea ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim();
}

// Parte el texto en renglones que quepan en maxAncho (respeta saltos de linea y corta palabras larguisimas)
function envolver(ctx, texto, maxAncho) {
  const lineas = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(' ')) {
      let candidata = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(candidata).width <= maxAncho) { actual = candidata; continue; }
      if (actual) { lineas.push(actual); actual = ''; }
      let resto = palabra;
      while (ctx.measureText(resto).width > maxAncho) { // palabra mas larga que el renglon: se parte por letras
        let n = resto.length;
        while (n > 1 && ctx.measureText(resto.slice(0, n)).width > maxAncho) n--;
        lineas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      actual = resto;
    }
    lineas.push(actual);
  }
  while (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop();
  return lineas;
}

function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// opciones: { nombre, texto, avatar (Buffer de imagen o null), semilla (para el color) } -> Buffer PNG (fondo transparente)
async function dibujarCita({ nombre, texto, avatar = null, semilla = nombre }) {
  const { createCanvas, loadImage } = cargarCanvas();
  const S = 2; // se dibuja al doble para que quede nitido al reducirlo a sticker
  const TEXTO = `28px "${FAMILIA}", "Noto Color Emoji", sans-serif`;
  const NOMBRE = `bold 26px "${FAMILIA}", "Noto Color Emoji", sans-serif`;
  const ANCHO_MAX = 330, PAD_X = 22, PAD_Y = 16, ALTO_NOMBRE = 36, ALTO_LINEA = 37, AV = 76, MARGEN = 10, HUECO = 12;

  const cuerpo = prepararTexto(texto, true) || '…';
  let titulo = prepararTexto(nombre, false) || 'Alguien';

  const m = createCanvas(10, 10).getContext('2d');
  m.font = NOMBRE;
  while (titulo.length > 1 && m.measureText(titulo).width > ANCHO_MAX) titulo = titulo.slice(0, -2).trimEnd() + '…';
  const anchoTitulo = m.measureText(titulo).width;
  m.font = TEXTO;
  const lineas = envolver(m, cuerpo, ANCHO_MAX);
  const anchoTexto = Math.max(...lineas.map((l) => m.measureText(l).width));

  const burbujaW = Math.ceil(Math.max(anchoTexto, anchoTitulo)) + PAD_X * 2;
  const burbujaH = PAD_Y + ALTO_NOMBRE + lineas.length * ALTO_LINEA + PAD_Y - 6;
  const W = MARGEN + AV + HUECO + burbujaW + MARGEN;
  const H = burbujaH + MARGEN * 2;

  const canvas = createCanvas(W * S, H * S);
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.textBaseline = 'alphabetic';

  // Burbuja
  const bx = MARGEN + AV + HUECO, by = MARGEN;
  ctx.fillStyle = '#1f1b2e';
  rectRedondeado(ctx, bx, by, burbujaW, burbujaH, 26);
  ctx.fill();

  // Nombre y texto
  ctx.fillStyle = COLORES_NOMBRE[hash(semilla) % COLORES_NOMBRE.length];
  ctx.font = NOMBRE;
  ctx.fillText(titulo, bx + PAD_X, by + PAD_Y + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = TEXTO;
  lineas.forEach((l, i) => ctx.fillText(l, bx + PAD_X, by + PAD_Y + ALTO_NOMBRE + 26 + i * ALTO_LINEA));

  // Avatar redondo (abajo a la izquierda, como en los chats); si no hay foto, una inicial de color
  const ax = MARGEN, ay = by + burbujaH - AV;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + AV / 2, ay + AV / 2, AV / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  let dibujado = false;
  if (avatar) {
    try {
      const img = await loadImage(avatar);
      const lado = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, ax, ay, AV, AV);
      dibujado = true;
    } catch (_) { dibujado = false; }
  }
  if (!dibujado) {
    ctx.fillStyle = COLORES_AVATAR[hash(semilla) % COLORES_AVATAR.length];
    ctx.fillRect(ax, ay, AV, AV);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 38px "${FAMILIA}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText([...titulo][0].toUpperCase(), ax + AV / 2, ay + AV / 2 + 13);
  }
  ctx.restore();

  return canvas.toBuffer('image/png');
}

module.exports = { dibujarCita, prepararTexto, envolver, _cargar: cargarCanvas };

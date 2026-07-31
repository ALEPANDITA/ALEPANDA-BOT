const Jimp = require('jimp');

const ANCHO = 900;
const ALTO = 1320;
const RADIO_TARJETA = 32;

// Paleta: verde bambu oscuro, con acentos verde claro y blanco/negro de panda
const COLOR_TOP = 0x0E2116FF;
const COLOR_BOTTOM = 0x162E1EFF;
const COLOR_PANEL = 0x1C3826FF;
const COLOR_PANEL_CLARO = 0x244A30FF;
const COLOR_ACENTO = 0x8CE07AFF;
const COLOR_BLANCO = 0xF5F5F0FF;
const COLOR_NEGRO = 0x1B1B1BFF;

function componentes(color) {
  return {
    r: (color >>> 24) & 0xFF,
    g: (color >>> 16) & 0xFF,
    b: (color >>> 8) & 0xFF,
    a: color & 0xFF
  };
}

function mezclar(colorA, colorB, t) {
  const a = componentes(colorA);
  const b = componentes(colorB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  const al = Math.round(a.a + (b.a - a.a) * t);
  return (r << 24) | (g << 16) | (bl << 8) | al;
}

function colorDeGradiente(y) {
  const t = Math.min(Math.max(y / (ALTO - 1), 0), 1);
  return mezclar(COLOR_TOP, COLOR_BOTTOM, t);
}

function degradadoVertical(imagen) {
  for (let y = 0; y < ALTO; y++) {
    const color = colorDeGradiente(y);
    for (let x = 0; x < ANCHO; x++) {
      imagen.setPixelColor(color, x, y);
    }
  }
}

// Circulo relleno. Si opacidad < 1, se mezcla con el color de fondo en ese punto
// (para los pandas "fantasma" que decoran el fondo sin tapar el texto).
function circuloRelleno(imagen, cx, cy, radio, color, opacidad = 1) {
  const x0 = Math.max(0, Math.floor(cx - radio));
  const x1 = Math.min(imagen.bitmap.width - 1, Math.ceil(cx + radio));
  const y0 = Math.max(0, Math.floor(cy - radio));
  const y1 = Math.min(imagen.bitmap.height - 1, Math.ceil(cy + radio));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x - cx, y - cy) <= radio) {
        const colorFinal = opacidad >= 1 ? color : mezclar(colorDeGradiente(y), color, opacidad);
        imagen.setPixelColor(colorFinal, x, y);
      }
    }
  }
}

function panelRedondeado(imagen, x, y, w, h, radio, color) {
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const enEsquinaX = px < radio || px >= w - radio;
      const enEsquinaY = py < radio || py >= h - radio;

      if (enEsquinaX && enEsquinaY) {
        const cx = px < radio ? radio : w - radio - 1;
        const cy = py < radio ? radio : h - radio - 1;
        if (Math.hypot(px - cx, py - cy) > radio) continue;
      }

      imagen.setPixelColor(color, x + px, y + py);
    }
  }
}

function redondearEsquinasCanvas(imagen, radio) {
  const ancho = imagen.bitmap.width;
  const alto = imagen.bitmap.height;
  for (let y = 0; y <= radio; y++) {
    for (let x = 0; x <= radio; x++) {
      if (Math.hypot(radio - x, radio - y) > radio) {
        imagen.setPixelColor(0x00000000, x, y);
        imagen.setPixelColor(0x00000000, ancho - 1 - x, y);
        imagen.setPixelColor(0x00000000, x, alto - 1 - y);
        imagen.setPixelColor(0x00000000, ancho - 1 - x, alto - 1 - y);
      }
    }
  }
}

// Dibuja una carita de panda simple con circulos: cabeza, orejas, parches de
// ojos, ojitos y nariz. `opacidad` < 1 lo vuelve un panda "fantasma" tenue,
// para usarlo como decoracion de fondo sin competir con el texto.
function dibujarPanda(imagen, cx, cy, r, opacidad = 1) {
  circuloRelleno(imagen, cx, cy, r, COLOR_BLANCO, opacidad);
  circuloRelleno(imagen, cx - r * 0.72, cy - r * 0.7, r * 0.36, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx + r * 0.72, cy - r * 0.7, r * 0.36, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx - r * 0.36, cy - r * 0.02, r * 0.3, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx + r * 0.36, cy - r * 0.02, r * 0.3, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx - r * 0.34, cy, r * 0.13, COLOR_BLANCO, opacidad);
  circuloRelleno(imagen, cx + r * 0.38, cy, r * 0.13, COLOR_BLANCO, opacidad);
  circuloRelleno(imagen, cx - r * 0.32, cy + r * 0.02, r * 0.065, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx + r * 0.4, cy + r * 0.02, r * 0.065, COLOR_NEGRO, opacidad);
  circuloRelleno(imagen, cx, cy + r * 0.3, r * 0.15, COLOR_NEGRO, opacidad);
}

async function generarTarjetaBotInfo({ prefix, comandos, usuarios, grupos, uptime, memoria, nodeVersion, owner, contacto }) {
  const imagen = new Jimp(ANCHO, ALTO, COLOR_TOP);
  degradadoVertical(imagen);

  // Pandas fantasma de fondo, repartidos por las esquinas para que decoren
  // sin taparse con los paneles de texto.
  const pandasFondo = [
    { x: 80, y: 150, r: 55 },
    { x: ANCHO - 85, y: 95, r: 38 },
    { x: 55, y: ALTO - 130, r: 48 },
    { x: ANCHO - 65, y: ALTO - 220, r: 42 },
    { x: ANCHO - 55, y: ALTO / 2 + 60, r: 34 },
    { x: 45, y: ALTO / 2 - 40, r: 30 }
  ];
  pandasFondo.forEach(p => dibujarPanda(imagen, p.x, p.y, p.r, 0.14));

  const fuenteTitulo = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fuenteSub = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fuenteLabel = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fuenteValor = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fuenteFooter = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  // Mascota principal, junto al titulo
  dibujarPanda(imagen, ANCHO / 2, 105, 58);

  imagen.print(fuenteTitulo, 0, 185, { text: 'ALEPANDA BOT', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ANCHO);
  imagen.print(fuenteSub, 0, 258, { text: 'INFORMACION DEL SISTEMA', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ANCHO);

  const filas = [
    { label: 'PREFIJO', valor: `[ ${prefix} ]` },
    { label: 'COMANDOS CARGADOS', valor: `${comandos}` },
    { label: 'USUARIOS REGISTRADOS', valor: `${usuarios}` },
    { label: 'GRUPOS REGISTRADOS', valor: `${grupos}` },
    { label: 'TIEMPO ACTIVO', valor: uptime },
    { label: 'MEMORIA USADA', valor: memoria },
    { label: 'NODE.JS', valor: nodeVersion }
  ];

  const xPanel = 60;
  const anchoPanel = ANCHO - 120;
  const altoFila = 96;
  const espacio = 16;
  let y = 320;

  filas.forEach(fila => {
    panelRedondeado(imagen, xPanel, y, anchoPanel, altoFila, 20, COLOR_PANEL);
    circuloRelleno(imagen, xPanel + 34, y + altoFila / 2, 8, COLOR_ACENTO);
    imagen.print(fuenteLabel, xPanel + 60, y + 16, { text: fila.label });
    imagen.print(fuenteValor, xPanel + 60, y + 42, { text: fila.valor });
    y += altoFila + espacio;
  });

  const altoFooter = 130;
  panelRedondeado(imagen, xPanel, y + 6, anchoPanel, altoFooter, 20, COLOR_PANEL_CLARO);
  dibujarPanda(imagen, xPanel + 58, y + 6 + altoFooter / 2, 32);
  imagen.print(fuenteLabel, xPanel + 106, y + 32, { text: 'DUEÑO Y CREADOR' });
  imagen.print(fuenteValor, xPanel + 106, y + 56, { text: owner });
  imagen.print(fuenteFooter, xPanel + 106, y + 98, { text: contacto });

  redondearEsquinasCanvas(imagen, RADIO_TARJETA);

  return imagen.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { generarTarjetaBotInfo };

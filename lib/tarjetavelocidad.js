const Jimp = require('jimp');

const ANCHO = 800;
const ALTO = 480;
const RADIO_TARJETA = 28;

// Paleta: azul noche -> indigo, con acentos dorado (subida) y azul (descarga)
const COLOR_TOP = 0x0A1428FF;
const COLOR_BOTTOM = 0x152343FF;
const COLOR_PANEL = 0x1C2C50FF;
const COLOR_PANEL_CLARO = 0x243660FF;
const COLOR_DESCARGA = 0x4FA3E3FF;
const COLOR_SUBIDA = 0xFFD700FF;
const COLOR_BARRA_FONDO = 0x0F1B36FF;

const MAX_ESCALA_MBPS = 500;

const FRASES_CALIDAD = [
  { min: 300, texto: 'Velocidad de garra veloz de alta prioridad' },
  { min: 100, texto: 'Buena velocidad, como un panda bien entrenado' },
  { min: 30, texto: 'Podria mejorar, como caracol post-pocima curativa' },
  { min: 0, texto: 'Lenta... pareciera que usas la Red Flu para internet' }
];

function obtenerFraseCalidad(mbps) {
  return FRASES_CALIDAD.find(f => mbps >= f.min)?.texto || FRASES_CALIDAD[FRASES_CALIDAD.length - 1].texto;
}

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

function degradadoVertical(imagen, colorTop, colorBottom) {
  for (let y = 0; y < ALTO; y++) {
    const t = y / (ALTO - 1);
    const color = mezclar(colorTop, colorBottom, t);
    for (let x = 0; x < ANCHO; x++) {
      imagen.setPixelColor(color, x, y);
    }
  }
}

function redondearEsquinasCanvas(imagen, radio) {
  for (let y = 0; y <= radio; y++) {
    for (let x = 0; x <= radio; x++) {
      if (Math.hypot(radio - x, radio - y) > radio) {
        imagen.setPixelColor(0x00000000, x, y);
      }
      if (Math.hypot(radio - x, radio - y) > radio) {
        imagen.setPixelColor(0x00000000, ANCHO - 1 - x, y);
      }
      if (Math.hypot(radio - x, radio - y) > radio) {
        imagen.setPixelColor(0x00000000, x, ALTO - 1 - y);
      }
      if (Math.hypot(radio - x, radio - y) > radio) {
        imagen.setPixelColor(0x00000000, ANCHO - 1 - x, ALTO - 1 - y);
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

function barraProgreso(imagen, x, y, anchoMax, alto, valorMbps, colorBarra) {
  const radio = Math.floor(alto / 2);
  panelRedondeado(imagen, x, y, anchoMax, alto, radio, COLOR_BARRA_FONDO);

  const proporcion = Math.min(valorMbps / MAX_ESCALA_MBPS, 1);
  const anchoLleno = Math.max(Math.round(anchoMax * proporcion), alto);
  panelRedondeado(imagen, x, y, anchoLleno, alto, radio, colorBarra);
}

async function generarTarjetaSpeedtest({ ping, jitter, descarga, subida }) {
  const imagen = new Jimp(ANCHO, ALTO, COLOR_TOP);
  degradadoVertical(imagen, COLOR_TOP, COLOR_BOTTOM);

  const fuenteTitulo = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fuenteNumero = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fuenteLabel = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  imagen.print(fuenteTitulo, 0, 28,
    { text: 'PRUEBA DE VELOCIDAD', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ANCHO);
  imagen.print(fuenteLabel, 0, 70,
    { text: obtenerFraseCalidad(descarga), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ANCHO);

  const anchoPanel = 360;
  const altoPanel = 190;
  const yPaneles = 110;
  const xIzq = 40;
  const xDer = ANCHO - anchoPanel - 40;

  panelRedondeado(imagen, xIzq, yPaneles, anchoPanel, altoPanel, 20, COLOR_PANEL);
  panelRedondeado(imagen, xDer, yPaneles, anchoPanel, altoPanel, 20, COLOR_PANEL);

  imagen.print(fuenteLabel, xIzq + 24, yPaneles + 18, { text: 'DESCARGA' });
  imagen.print(fuenteNumero, xIzq + 20, yPaneles + 45, { text: `${descarga}` });
  imagen.print(fuenteLabel, xIzq + 24, yPaneles + 118, { text: 'Mbps' });
  barraProgreso(imagen, xIzq + 24, yPaneles + altoPanel - 34, anchoPanel - 48, 14, descarga, COLOR_DESCARGA);

  imagen.print(fuenteLabel, xDer + 24, yPaneles + 18, { text: 'SUBIDA' });
  imagen.print(fuenteNumero, xDer + 20, yPaneles + 45, { text: `${subida}` });
  imagen.print(fuenteLabel, xDer + 24, yPaneles + 118, { text: 'Mbps' });
  barraProgreso(imagen, xDer + 24, yPaneles + altoPanel - 34, anchoPanel - 48, 14, subida, COLOR_SUBIDA);

  const yFila = yPaneles + altoPanel + 20;
  const altoFila = 80;
  const anchoFila = (ANCHO - 80 - 20 * 2) / 3;

  const datosFila = [
    { label: 'PING', valor: `${ping} ms` },
    { label: 'JITTER', valor: `${jitter} ms` },
    { label: 'RED', valor: 'Cloudflare' }
  ];

  datosFila.forEach((dato, i) => {
    const x = 40 + i * (anchoFila + 20);
    panelRedondeado(imagen, x, yFila, anchoFila, altoFila, 16, COLOR_PANEL_CLARO);
    imagen.print(fuenteLabel, x, yFila + 14, { text: dato.label, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, anchoFila);
    imagen.print(fuenteTitulo, x, yFila + 36, { text: dato.valor, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, anchoFila);
  });

  imagen.print(fuenteLabel, 0, ALTO - 34,
    { text: 'ALEPANDA BOT - Panda Network Division', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ANCHO);

  redondearEsquinasCanvas(imagen, RADIO_TARJETA);

  return imagen.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { generarTarjetaSpeedtest };

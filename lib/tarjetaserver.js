const Jimp = require('jimp');
const os = require('os');
const { execSync } = require('child_process');

const ANCHO = 900;
const ALTO = 620;
const RADIO_TARJETA = 28;

const COLOR_TOP = 0x0A1420FF;
const COLOR_BOTTOM = 0x0F2233FF;
const COLOR_PANEL = 0x152B3EFF;
const COLOR_ACENTO = 0x4FD1E8FF;
const COLOR_VERDE = 0x5FD98AFF;
const COLOR_AMARILLO = 0xE8C94FFF;
const COLOR_ROJO = 0xE85F5FFF;

function componentes(color) {
  return { r: (color >>> 24) & 0xFF, g: (color >>> 16) & 0xFF, b: (color >>> 8) & 0xFF, a: color & 0xFF };
}
function mezclar(colorA, colorB, t) {
  const a = componentes(colorA), b = componentes(colorB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return ((r << 24) | (g << 16) | (bl << 8) | 0xFF) >>> 0;
}

function ponerPixelDirecto(imagen, x, y, colorHex) {
  const { width, height, data } = imagen.bitmap;
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = (y * width + x) * 4;
  data[idx] = (colorHex >>> 24) & 0xFF;
  data[idx + 1] = (colorHex >>> 16) & 0xFF;
  data[idx + 2] = (colorHex >>> 8) & 0xFF;
  data[idx + 3] = colorHex & 0xFF;
}

function degradadoVertical(imagen) {
  for (let y = 0; y < ALTO; y++) {
    const color = mezclar(COLOR_TOP, COLOR_BOTTOM, y / (ALTO - 1));
    for (let x = 0; x < ANCHO; x++) ponerPixelDirecto(imagen, x, y, color);
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
      ponerPixelDirecto(imagen, x + px, y + py, color);
    }
  }
}

function redondearEsquinasCanvas(imagen, radio) {
  for (let y = 0; y <= radio; y++) {
    for (let x = 0; x <= radio; x++) {
      if (Math.hypot(radio - x, radio - y) > radio) {
        ponerPixelDirecto(imagen, x, y, 0x00000000);
        ponerPixelDirecto(imagen, ANCHO - 1 - x, y, 0x00000000);
        ponerPixelDirecto(imagen, x, ALTO - 1 - y, 0x00000000);
        ponerPixelDirecto(imagen, ANCHO - 1 - x, ALTO - 1 - y, 0x00000000);
      }
    }
  }
}

function barraProgreso(imagen, x, y, w, h, porcentaje) {
  panelRedondeado(imagen, x, y, w, h, h / 2, 0x0D1B28FF);
  const anchoLleno = Math.max(h, Math.round((w - 6) * Math.min(porcentaje, 100) / 100));
  const color = porcentaje >= 85 ? COLOR_ROJO : porcentaje >= 60 ? COLOR_AMARILLO : COLOR_VERDE;
  panelRedondeado(imagen, x + 3, y + 3, anchoLleno, h - 6, (h - 6) / 2, color);
}

function centrarTexto(imagen, font, texto, cx, y) {
  const ancho = Jimp.measureText(font, texto);
  imagen.print(font, Math.round(cx - ancho / 2), y, texto);
}

function obtenerDisco() {
  try {
    const salida = execSync('df -k / | tail -1').toString().trim().split(/\s+/);
    const totalKB = Number(salida[1]);
    const usadoKB = Number(salida[2]);
    return {
      usadoGB: usadoKB / 1024 / 1024,
      totalGB: totalKB / 1024 / 1024,
      porcentaje: totalKB ? (usadoKB / totalKB) * 100 : 0
    };
  } catch (err) {
    return null;
  }
}

function formatearUptime(segundos) {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function generarTarjetaServer() {
  const imagen = new Jimp(ANCHO, ALTO, COLOR_TOP);
  degradadoVertical(imagen);

  const fuenteTitulo = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fuenteLabel = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fuenteValor = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fuenteValorGrande = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  centrarTexto(imagen, fuenteTitulo, 'SERVIDOR · ESTADO EN VIVO', ANCHO / 2, 26);

  const memTotal = os.totalmem();
  const memLibre = os.freemem();
  const memUsada = memTotal - memLibre;
  const porcentajeRam = (memUsada / memTotal) * 100;

  const disco = obtenerDisco();
  const [load1, load5, load15] = os.loadavg();
  const cpuModelo = os.cpus()[0]?.model?.trim() || 'Desconocido';
  const nucleos = os.cpus().length;

  const xPanel = 40;
  const anchoPanel = ANCHO - 80;
  const anchoColumna = (anchoPanel - 16) / 2;
  let y = 78;

  const celdas = [
    { label: 'SISTEMA OPERATIVO', valor: `${os.type()} ${os.release()}` },
    { label: 'PROCESADOR', valor: cpuModelo.length > 26 ? cpuModelo.slice(0, 24) + '..' : cpuModelo },
    { label: 'NUCLEOS · NODE.JS', valor: `${nucleos} nucleos · ${process.version}` },
    { label: 'LOAD AVG (1m/5m/15m)', valor: `${load1.toFixed(2)} / ${load5.toFixed(2)} / ${load15.toFixed(2)}` }
  ];

  const altoCelda = 62;
  celdas.forEach((celda, i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = xPanel + col * (anchoColumna + 16);
    const yy = y + fila * (altoCelda + 12);

    panelRedondeado(imagen, x, yy, anchoColumna, altoCelda, 14, COLOR_PANEL);
    ponerPixelDirecto(imagen, x + 20, yy + altoCelda / 2, COLOR_ACENTO);
    imagen.print(fuenteLabel, x + 20, yy + 10, { text: celda.label });
    imagen.print(fuenteValor, x + 20, yy + 32, { text: celda.valor });
  });

  y += 2 * (altoCelda + 12) + 8;

  const yBarraLabel = y;
  imagen.print(fuenteLabel, xPanel, yBarraLabel, {
    text: `RAM  ${(memUsada / 1024 / 1024 / 1024).toFixed(1)}/${(memTotal / 1024 / 1024 / 1024).toFixed(1)} GB`
  });
  if (disco) {
    imagen.print(fuenteLabel, xPanel + anchoColumna + 16, yBarraLabel, {
      text: `DISCO  ${disco.usadoGB.toFixed(1)}/${disco.totalGB.toFixed(1)} GB`
    });
  } else {
    imagen.print(fuenteLabel, xPanel + anchoColumna + 16, yBarraLabel, { text: 'DISCO  N/D' });
  }

  y += 22;
  barraProgreso(imagen, xPanel, y, anchoColumna, 26, porcentajeRam);
  if (disco) barraProgreso(imagen, xPanel + anchoColumna + 16, y, anchoColumna, 26, disco.porcentaje);

  y += 40;

  const altoFooter = 84;
  panelRedondeado(imagen, xPanel, y, anchoColumna, altoFooter, 14, COLOR_PANEL);
  imagen.print(fuenteLabel, xPanel + 18, y + 12, { text: 'UPTIME SERVIDOR' });
  imagen.print(fuenteValorGrande, xPanel + 18, y + 34, { text: formatearUptime(os.uptime()) });

  panelRedondeado(imagen, xPanel + anchoColumna + 16, y, anchoColumna, altoFooter, 14, COLOR_PANEL);
  imagen.print(fuenteLabel, xPanel + anchoColumna + 16 + 18, y + 12, { text: 'UPTIME BOT' });
  imagen.print(fuenteValorGrande, xPanel + anchoColumna + 16 + 18, y + 34, { text: formatearUptime(process.uptime()) });

  y += altoFooter + 14;
  centrarTexto(imagen, fuenteLabel, 'ALEPANDA BOT · SERVER MONITOR', ANCHO / 2, y);

  redondearEsquinasCanvas(imagen, RADIO_TARJETA);

  return imagen.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { generarTarjetaServer };

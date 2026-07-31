// lib/bienvenidaImagen.js
//
// Genera la tarjeta de bienvenida/despedida usando como fondo la plantilla
// real (bosque de bambu de dia para bienvenida, de noche para despedida), y
// le superpone: la foto de perfil circular (o un circulo con degradado +
// hojita si no hay foto), el nombre de quien entra/sale, y los valores de
// miembros/fecha/hora en sus recuadros.

const path = require('path');
const Jimp = require('jimp');

const ANCHO = 1086;
const ALTO = 1448;

const CIRCULO_CX = 543;
const CIRCULO_CY = 540;
const CIRCULO_RADIO = 205;

// Columnas de MIEMBROS / FECHA / HORA (coordenadas medidas sobre la plantilla real)
const COLUMNAS = [
  { cx: 220, xIni: 80, xFin: 360 },
  { cx: 543, xIni: 400, xFin: 680 },
  { cx: 866, xIni: 720, xFin: 1000 }
];
const FILA_VALOR_Y = 1180;
const FILA_VALOR_ALTO = 90;

const PLANTILLAS = {
  welcome: {
    ruta: path.join(__dirname, '..', 'assets', 'bienvenida', 'plantilla-dia.jpg'),
    fondoPanel: 0xEDE5D7FF,
    fuenteValor: Jimp.FONT_SANS_64_BLACK,
    fuenteValorChica: Jimp.FONT_SANS_32_BLACK,
    fuenteNombre: Jimp.FONT_SANS_32_BLACK,
    fuenteSub: Jimp.FONT_SANS_32_BLACK,
    fuenteSubChica: Jimp.FONT_SANS_16_BLACK,
    colorRespaldo: { centro: 0xF5F0E4FF, borde: 0xC9BFA0FF, hoja: 0x5C6B2FFF },
    subtitulo: (grupo) => `se unio a ${grupo}`
  },
  bye: {
    ruta: path.join(__dirname, '..', 'assets', 'despedida', 'plantilla-noche.jpg'),
    fondoPanel: 0x18281CFF,
    fuenteValor: Jimp.FONT_SANS_64_WHITE,
    fuenteValorChica: Jimp.FONT_SANS_32_WHITE,
    fuenteNombre: Jimp.FONT_SANS_32_WHITE,
    fuenteSub: Jimp.FONT_SANS_32_WHITE,
    fuenteSubChica: Jimp.FONT_SANS_16_WHITE,
    colorRespaldo: { centro: 0x3A4A38FF, borde: 0x18281CFF, hoja: 0x8FA85CFF },
    subtitulo: (grupo) => `salio de ${grupo}`
  }
};

const cacheFuentes = {};
function obtenerFuente(ruta) {
  if (!cacheFuentes[ruta]) cacheFuentes[ruta] = Jimp.loadFont(ruta);
  return cacheFuentes[ruta];
}

// La plantilla (fondo) es la misma imagen en cada bienvenida/despedida, asi
// que leerla y decodificarla del disco en CADA evento era el cuello de
// botella mas grande: Jimp decodifica JPEG en JS puro, y eso solo puede
// costar uno o varios segundos por evento. Ahora se decodifica una sola vez
// y se reusa un .clone() (barato) por cada tarjeta.
const cachePlantillas = {};
async function obtenerPlantilla(ruta) {
  if (!cachePlantillas[ruta]) {
    cachePlantillas[ruta] = await Jimp.read(ruta);
  }
  return cachePlantillas[ruta].clone();
}

function precalentar() {
  Object.values(PLANTILLAS).forEach(p => {
    obtenerPlantilla(p.ruta).catch(() => {});
    [p.fuenteValor, p.fuenteValorChica, p.fuenteNombre, p.fuenteSub, p.fuenteSubChica]
      .forEach(f => obtenerFuente(f).catch(() => {}));
  });
}
precalentar();

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

function circuloDegradado(imagen, cx, cy, radio, colorCentro, colorBorde) {
  const { width, height, data } = imagen.bitmap;
  const rc = (colorCentro >>> 24) & 0xFF, gc = (colorCentro >>> 16) & 0xFF, bc = (colorCentro >>> 8) & 0xFF;
  const rb = (colorBorde >>> 24) & 0xFF, gb = (colorBorde >>> 16) & 0xFF, bb = (colorBorde >>> 8) & 0xFF;
  for (let y = Math.max(0, cy - radio); y <= Math.min(height - 1, cy + radio); y++) {
    for (let x = Math.max(0, cx - radio); x <= Math.min(width - 1, cx + radio); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radio) continue;
      const t = Math.min(1, d / radio);
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(rc + (rb - rc) * t);
      data[idx + 1] = Math.round(gc + (gb - gc) * t);
      data[idx + 2] = Math.round(bc + (bb - bc) * t);
      data[idx + 3] = 255;
    }
  }
}

function hojaSimple(imagen, cx, cy, largo, ancho, anguloGrados, colorHex) {
  const { width, height, data } = imagen.bitmap;
  const r = (colorHex >>> 24) & 0xFF, g = (colorHex >>> 16) & 0xFF, b = (colorHex >>> 8) & 0xFF, a = colorHex & 0xFF;
  const ang = (anguloGrados * Math.PI) / 180;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const mitadLargo = largo / 2, mitadAncho = ancho / 2;
  const alcance = Math.ceil(largo / 2 + ancho / 2) + 1;
  for (let y = -alcance; y <= alcance; y++) {
    const py = Math.round(cy + y);
    if (py < 0 || py >= height) continue;
    for (let x = -alcance; x <= alcance; x++) {
      const px = Math.round(cx + x);
      if (px < 0 || px >= width) continue;
      const lx = x * cos + y * sin;
      const ly = -x * sin + y * cos;
      if (Math.abs(lx) > mitadLargo) continue;
      const anchoEnX = mitadAncho * (1 - Math.abs(lx) / mitadLargo);
      if (Math.abs(ly) <= anchoEnX) {
        const idx = (py * width + px) * 4;
        data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
      }
    }
  }
}

// Cuando no hay foto de perfil: un circulo con degradado suave y una hojita
// al centro. Nada de caritas ni formas recargadas (a peticion explicita).
function circuloRespaldo(imagen, cx, cy, radio, colores) {
  circuloDegradado(imagen, cx, cy, radio, colores.centro, colores.borde);
  hojaSimple(imagen, cx - radio * 0.12, cy, radio * 0.62, radio * 0.22, -28, colores.hoja);
  hojaSimple(imagen, cx + radio * 0.12, cy, radio * 0.62, radio * 0.22, 28, colores.hoja);
}

async function circularizarFoto(bufferFoto, diametro) {
  const foto = await Jimp.read(bufferFoto);
  foto.cover(diametro, diametro);
  foto.circle();
  return foto;
}

function centrarTexto(imagen, font, texto, cx, cy) {
  const ancho = Jimp.measureText(font, texto);
  const alto = Jimp.measureTextHeight(font, texto, ancho);
  imagen.print(font, Math.round(cx - ancho / 2), Math.round(cy - alto / 2), texto);
}

// Si el texto no cabe en anchoMaximo con la fuente grande, usa la chica.
function centrarTextoAjustado(imagen, fuenteGrande, fuenteChica, anchoMaximo, texto, cx, cy) {
  let font = fuenteGrande;
  let ancho = Jimp.measureText(font, texto);
  if (ancho > anchoMaximo) {
    font = fuenteChica;
    ancho = Jimp.measureText(font, texto);
  }
  const alto = Jimp.measureTextHeight(font, texto, ancho);
  imagen.print(font, Math.round(cx - ancho / 2), Math.round(cy - alto / 2), texto);
}

async function generarImagenEvento({ tipo, fotoBuffer, nombreGrupo, totalMiembros, numero, nombreConocido }) {
  const inicio = Date.now();
  const paleta = PLANTILLAS[tipo] || PLANTILLAS.bye;

  const [fuenteValor, fuenteValorChica, fuenteNombre, fuenteSub, fuenteSubChica, imagen, foto] = await Promise.all([
    obtenerFuente(paleta.fuenteValor),
    obtenerFuente(paleta.fuenteValorChica),
    obtenerFuente(paleta.fuenteNombre),
    obtenerFuente(paleta.fuenteSub),
    obtenerFuente(paleta.fuenteSubChica),
    obtenerPlantilla(paleta.ruta),
    fotoBuffer
      ? circularizarFoto(fotoBuffer, CIRCULO_RADIO * 2).catch(err => {
          console.error('No se pudo procesar la foto de perfil:', err.message);
          return null;
        })
      : Promise.resolve(null)
  ]);
  const tFoto = Date.now();

  if (foto) {
    imagen.composite(foto, CIRCULO_CX - CIRCULO_RADIO, CIRCULO_CY - CIRCULO_RADIO);
  } else {
    circuloRespaldo(imagen, CIRCULO_CX, CIRCULO_CY, CIRCULO_RADIO, paleta.colorRespaldo);
  }

  const etiqueta = nombreConocido || (numero ? `+${numero}` : 'Alguien');
  const yNombre = CIRCULO_CY + CIRCULO_RADIO + 60;
  centrarTextoAjustado(imagen, fuenteNombre, fuenteValorChica, ANCHO - 120, etiqueta, ANCHO / 2, yNombre);

  let grupoCorto = String(nombreGrupo || 'este grupo');
  if (grupoCorto.length > 30) grupoCorto = grupoCorto.slice(0, 28) + '..';
  centrarTextoAjustado(imagen, fuenteSub, fuenteSubChica, ANCHO - 140, paleta.subtitulo(grupoCorto), ANCHO / 2, yNombre + 60);

  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const valores = [String(totalMiembros ?? '--'), fecha, hora];

  COLUMNAS.forEach((col, i) => {
    // tapamos el placeholder "---" de la plantilla con el color del panel
    for (let y = FILA_VALOR_Y - FILA_VALOR_ALTO / 2; y < FILA_VALOR_Y + FILA_VALOR_ALTO / 2; y++) {
      for (let x = col.xIni; x < col.xFin; x++) {
        ponerPixelDirecto(imagen, x, y, paleta.fondoPanel);
      }
    }
    centrarTextoAjustado(imagen, fuenteValor, fuenteValorChica, col.xFin - col.xIni - 12, valores[i], col.cx, FILA_VALOR_Y);
  });

  const tDibujo = Date.now();

  // Todo se dibujo a tamano completo (para que el texto y el circulo queden
  // nitidos), pero se reduce antes de codificar: la codificacion JPEG es lo
  // mas pesado de todo el proceso y su costo escala con la cantidad de
  // pixeles, asi que achicar aqui es la forma mas facil de ganar velocidad
  // sin tener que rehacer las plantillas ni las coordenadas.
  imagen.resize(Math.round(ANCHO * 0.6), Jimp.AUTO);
  imagen.quality(72);
  const buffer = await imagen.getBufferAsync(Jimp.MIME_JPEG);
  const tFinal = Date.now();

  console.log(
    `[bienvenida/despedida] foto+plantilla: ${tFoto - inicio}ms | ` +
    `dibujar: ${tDibujo - tFoto}ms | codificar: ${tFinal - tDibujo}ms | TOTAL: ${tFinal - inicio}ms`
  );

  return buffer;
}

module.exports = { generarImagenEvento };

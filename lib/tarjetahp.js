const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const CARPETA_IMAGENES = path.join(__dirname, '..', 'assets', 'personajeshp');
const CARPETA_CASAS = path.join(__dirname, '..', 'assets', 'personajeshp', 'casas');
const EXTENSIONES = ['.jpg', '.jpeg', '.png', '.webp'];

const COLORES_CASA = {
  Gryffindor: 0x7F0909FF,
  Slytherin: 0x1A472AFF,
  Hufflepuff: 0xECB939FF,
  Ravenclaw: 0x0E1A40FF,
  Staff: 0x3A3A3AFF,
  'Diagon Alley': 0x5B3A29FF,
  Beauxbatons: 0x8E7CC3FF,
  Alquimista: 0x8B6914FF
};

const COLORES_RAREZA = {
  comun: 0xB0B0B0FF,
  rara: 0x4FA3E3FF,
  epica: 0xA259D9FF,
  legendaria: 0xFFD700FF
};

// Convierte "Harry Potter" -> "harry-potter"
function slugify(nombre) {
  return nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Busca si existe una foto subida para este personaje (jpg, png, webp...)
function buscarImagenPersonaje(nombre) {
  const slug = slugify(nombre);
  for (const ext of EXTENSIONES) {
    const ruta = path.join(CARPETA_IMAGENES, slug + ext);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

// Respaldo: ilustración genérica de la casa (no requiere foto del personaje)
function buscarImagenCasa(casa) {
  const slug = slugify(casa);
  for (const ext of EXTENSIONES) {
    const ruta = path.join(CARPETA_CASAS, slug + ext);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

async function generarTarjetaConFoto(personaje, rutaImagen) {
  const ancho = 600;
  const alto = 800;
  const altoBanner = 190;
  const colorRareza = COLORES_RAREZA[personaje.rareza] || 0xFFFFFFFF;
  const colorBanner = COLORES_CASA[personaje.casa] || 0x2C2C2CFF;

  const imagen = new Jimp(ancho, alto, colorBanner);

  const foto = await Jimp.read(rutaImagen);
  foto.cover(ancho, alto - altoBanner);
  imagen.composite(foto, 0, 0);

  // Cintillo inferior con info del personaje
  for (let y = alto - altoBanner; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      imagen.setPixelColor(colorBanner, x, y);
    }
  }

  // Borde de color según rareza
  const grosor = 10;
  for (let x = 0; x < ancho; x++) {
    for (let y = 0; y < grosor; y++) {
      imagen.setPixelColor(colorRareza, x, y);
      imagen.setPixelColor(colorRareza, x, alto - 1 - y);
    }
  }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < grosor; x++) {
      imagen.setPixelColor(colorRareza, x, y);
      imagen.setPixelColor(colorRareza, ancho - 1 - x, y);
    }
  }

  const fuenteTitulo = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fuenteTexto = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  const yBase = alto - altoBanner + 15;
  imagen.print(fuenteTitulo, 20, yBase,
    { text: personaje.nombre, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho - 40);

  imagen.print(fuenteTexto, 20, yBase + 55,
    { text: `${personaje.emoji}  Casa: ${personaje.casa}  |  ${personaje.rareza.toUpperCase()}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho - 40);

  imagen.print(fuenteTexto, 40, yBase + 90,
    { text: `"${personaje.frase}"`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho - 80);

  return imagen.getBufferAsync(Jimp.MIME_PNG);
}

async function generarTarjetaSinFoto(personaje) {
  const ancho = 600;
  const alto = 800;
  const colorFondo = COLORES_CASA[personaje.casa] || 0x2C2C2CFF;
  const colorRareza = COLORES_RAREZA[personaje.rareza] || 0xFFFFFFFF;

  const imagen = new Jimp(ancho, alto, colorFondo);

  const grosor = 14;
  for (let x = 0; x < ancho; x++) {
    for (let y = 0; y < grosor; y++) {
      imagen.setPixelColor(colorRareza, x, y);
      imagen.setPixelColor(colorRareza, x, alto - 1 - y);
    }
  }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < grosor; x++) {
      imagen.setPixelColor(colorRareza, x, y);
      imagen.setPixelColor(colorRareza, ancho - 1 - x, y);
    }
  }

  const fuenteTitulo = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fuenteSub = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fuenteTexto = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  imagen.print(fuenteSub, 0, 60,
    { text: personaje.rareza.toUpperCase(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho);

  imagen.print(fuenteTitulo, 40, 150,
    { text: personaje.nombre, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho - 80);

  imagen.print(fuenteSub, 0, 340,
    { text: `${personaje.emoji}  Casa: ${personaje.casa}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho);

  imagen.print(fuenteTexto, 60, 440,
    { text: `"${personaje.frase}"`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho - 120);

  imagen.print(fuenteSub, 0, alto - 90,
    { text: 'ALEPANDA BOT', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, ancho);

  return imagen.getBufferAsync(Jimp.MIME_PNG);
}

async function generarTarjeta(personaje) {
  const rutaImagen = buscarImagenPersonaje(personaje.nombre) || buscarImagenCasa(personaje.casa);
  if (rutaImagen) {
    return generarTarjetaConFoto(personaje, rutaImagen);
  }
  return generarTarjetaSinFoto(personaje);
}

module.exports = { generarTarjeta, slugify, buscarImagenPersonaje, buscarImagenCasa, CARPETA_IMAGENES, CARPETA_CASAS };

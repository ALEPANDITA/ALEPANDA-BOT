const fs = require('fs');
const path = require('path');
const { CARPETA_SUBBOTS } = require('./subbots');

const LIMITE_DESCARGAS_SERBOT = 100;

function rutaContador(id) {
  return path.join(CARPETA_SUBBOTS, id, 'descargas.json');
}

function hoy() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function leerContador(id) {
  const ruta = rutaContador(id);
  if (!fs.existsSync(ruta)) return { fecha: hoy(), contador: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    if (data.fecha !== hoy()) return { fecha: hoy(), contador: 0 };
    return data;
  } catch {
    return { fecha: hoy(), contador: 0 };
  }
}

function guardarContador(id, data) {
  fs.writeFileSync(rutaContador(id), JSON.stringify(data, null, 2));
}

// Devuelve { permitido: bool, restantes: number }
function verificarLimiteDescarga(id) {
  const data = leerContador(id);
  const restantes = LIMITE_DESCARGAS_SERBOT - data.contador;
  return { permitido: restantes > 0, restantes: Math.max(0, restantes) };
}

function registrarDescarga(id) {
  const data = leerContador(id);
  data.contador += 1;
  guardarContador(id, data);
  return data.contador;
}

module.exports = { LIMITE_DESCARGAS_SERBOT, verificarLimiteDescarga, registrarDescarga };

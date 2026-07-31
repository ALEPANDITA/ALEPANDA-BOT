const fs = require('fs');
const path = require('path');
const rutaArchivo = path.join(__dirname, '..', 'confesiones.json');

function leerConfesiones() {
  if (!fs.existsSync(rutaArchivo)) {
    fs.writeFileSync(rutaArchivo, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'));
}

function guardarConfesion(entrada) {
  const lista = leerConfesiones();
  lista.push(entrada);
  fs.writeFileSync(rutaArchivo, JSON.stringify(lista, null, 2));
}

module.exports = { leerConfesiones, guardarConfesion };

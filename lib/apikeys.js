const fs = require('fs');
const path = require('path');
const keysPath = path.join(__dirname, '..', 'api-keys.json');

function leerKeys() {
  if (!fs.existsSync(keysPath)) {
    const inicial = {};
    fs.writeFileSync(keysPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  return JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
}

function guardarKeys(keys) {
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
}

function getApiKey(servicio) {
  const keys = leerKeys();
  return keys[servicio] || null;
}

function setApiKey(servicio, valor) {
  const keys = leerKeys();
  keys[servicio] = valor;
  guardarKeys(keys);
}

module.exports = { leerKeys, guardarKeys, getApiKey, setApiKey };

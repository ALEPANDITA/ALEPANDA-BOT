const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.json');

// Owner fijo en el codigo: asi el bot te reconoce como owner en cualquier lugar
// donde lo subas (VPS, panel, Termux, etc), sin depender de que exista config.json
const OWNER_FIJO = '527732654942@s.whatsapp.net';

function leerConfig() {
  if (!fs.existsSync(configPath)) {
    const inicial = { prefix: '.', mainOwner: OWNER_FIJO, owners: [OWNER_FIJO] };
    fs.writeFileSync(configPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!config.owners) config.owners = [];
  if (!config.owners.includes(OWNER_FIJO)) config.owners.push(OWNER_FIJO);
  if (!config.mainOwner) config.mainOwner = OWNER_FIJO;
  return config;
}

function guardarConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { leerConfig, guardarConfig };

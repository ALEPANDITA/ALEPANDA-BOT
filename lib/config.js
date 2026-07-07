const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.json');

function leerConfig() {
  if (!fs.existsSync(configPath)) {
    const inicial = { prefix: '.', mainOwner: null, owners: [] };
    fs.writeFileSync(configPath, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!config.owners) config.owners = [];
  return config;
}

function guardarConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { leerConfig, guardarConfig };

// lib/mei.js
// Mei: la IA chica del bot (dulce, tierna y con chispa). Misma tecnologia que Pandita pero con su propia
// personalidad, memoria (mei-data.json), mencion (@Mei) y voz.
const { crearPersona } = require('./ia-persona');
const { MEI } = require('./ia-personalidades');

module.exports = crearPersona(MEI);

// lib/pandita.js
// Pandita: IA tranquila y malhablada (mezcla de la calma de Panda con las groserias de Simi), INDEPENDIENTE de ellos.
// El motor vive en lib/ia-persona.js y su forma de ser en lib/ia-personalidades.js.
// Su memoria sigue en pandita-data.json (no se pierde nada de lo que ya habia guardado).
const { crearPersona } = require('./ia-persona');
const { PANDITA } = require('./ia-personalidades');

module.exports = crearPersona(PANDITA);

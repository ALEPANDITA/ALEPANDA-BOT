const { crearComando } = require('../../lib/stickersonidocmd');

// .sa -> sticker normal con sonido
module.exports = crearComando({ name: 'stickersonido', aliases: ['sa'], vip: false });

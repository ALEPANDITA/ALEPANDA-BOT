const { crearComando } = require('../../lib/stickersonidocmd');

// .sv -> sticker VIP con sonido (EXIF premium + isAvatar)
module.exports = crearComando({ name: 'stickersonidovip', aliases: ['sv'], vip: true });

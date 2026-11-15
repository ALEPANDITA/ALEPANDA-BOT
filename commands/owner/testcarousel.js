// Prueba del carrusel con el fork ultra-baileys (usa lib/carrusel.js)
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { enviarCarrusel } = require('../../lib/carrusel');

module.exports = {
  name: 'testcarousel',
  category: 'owner',
  description: 'Prueba si el carrusel de imagenes se ve bien (solo owner)',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }
    try {
      await enviarCarrusel(sock, jid, msg, {
        texto: '🎠 Prueba de carrusel',
        footer: 'ALEPANDA BOT',
        titulo: 'Prueba',
        tarjetas: [1, 2, 3].map((n) => ({
          imagen: `https://picsum.photos/seed/panda${n}/500/500`,
          titulo: `Tarjeta ${n}`,
          texto: n === 3 ? 'Ultima tarjeta de prueba.' : 'Desliza para ver la siguiente.',
          botones: [
            { texto: '🏓 Ping', id: `${prefix}ping` },
            { texto: '🌐 Abrir link', url: 'https://example.com' }
          ]
        }))
      });
    } catch (err) {
      console.error('[testcarousel] Error:', err);
      await sock.sendMessage(jid, { text: `❌ El carrusel fallo: ${err.message}` }, { quoted: msg });
    }
  }
};

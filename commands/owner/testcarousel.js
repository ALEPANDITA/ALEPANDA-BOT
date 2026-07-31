// Comando de prueba para confirmar que el carrusel del fork fsociety-Baileys
// realmente se ve como carrusel en WhatsApp antes de usarlo en comandos reales.
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'testcarousel',
  category: 'owner',
  description: 'Prueba si el carrusel de imagenes se ve bien (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }
    try {
      await sock.sendMessage(jid, {
        text: '🎠 Prueba de carrusel',
        footer: 'ALEPANDA BOT',
        cards: [
          {
            image: { url: 'https://picsum.photos/seed/panda1/500/500' },
            caption: '*Tarjeta 1*\nEsto deberia verse como una tarjeta deslizable.',
            footer: 'Card 1',
            nativeFlow: [
              { text: 'Abrir link', url: 'https://example.com', useWebview: true }
            ]
          },
          {
            image: { url: 'https://picsum.photos/seed/panda2/500/500' },
            caption: '*Tarjeta 2*\nSi ves esta deslizando desde la 1, funciono.',
            footer: 'Card 2',
            nativeFlow: [
              { text: 'Abrir link', url: 'https://example.com', useWebview: true }
            ]
          },
          {
            image: { url: 'https://picsum.photos/seed/panda3/500/500' },
            caption: '*Tarjeta 3*\nUltima tarjeta de prueba.',
            footer: 'Card 3',
            nativeFlow: [
              { text: 'Abrir link', url: 'https://example.com', useWebview: true }
            ]
          }
        ]
      }, { quoted: msg });
    } catch (err) {
      console.error('[testcarousel] Error:', err);
      await sock.sendMessage(jid, { text: `❌ El carrusel fallo: ${err.message}\n\nProbablemente WhatsApp lo esta bloqueando para cuentas normales (no Business API). Revisa los logs completos con pm2 logs.` }, { quoted: msg });
    }
  }
};

const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'femboy',
  aliases: ['nsfwfemboy'],
  category: 'nsfw',
  description: 'Envía una imagen o gif aleatorio. Uso: .femboy',
  execute: async (sock, jid, msg, { prefix }) => {
    // Endpoints públicos y alternativos orientados a contenido estético/anime de uso libre
    const apis = [
      'https://nekos.life/api/v2/img/woof',
      'https://api.waifu.pics/sfw/neko',
      'https://nekos.best/api/v2/neko',
      'https://api.waifu.pics/sfw/waifu'
    ];

    let mediaUrl = null;

    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        
        if (!response.ok) continue;

        const data = await response.json();
        
        // Estructura para nekos.life (.url)
        if (data && typeof data.url === 'string') {
          mediaUrl = data.url;
          break;
        }

        // Estructura para nekos.best (results[0].url)
        if (data && data.results && data.results[0] && typeof data.results[0].url === 'string') {
          mediaUrl = data.results[0].url;
          break;
        }
      } catch (e) {
        // Continuar con el siguiente endpoint si ocurre un fallo
        continue;
      }
    }

    if (!mediaUrl) {
      return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen en este momento. Inténtalo más tarde.') });
    }

    try {
      const sender = msg.key.participant || msg.key.remoteJid;

      await sock.sendMessage(jid, {
        image: { url: mediaUrl },
        caption: `Aquí tienes @${sender.split('@')[0]}`,
        mentions: [sender]
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al enviar la imagen.') });
    }
  }
};
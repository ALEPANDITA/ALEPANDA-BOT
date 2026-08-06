const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'yuri',
  aliases: ['animeyuri'],
  category: 'animeimg',
  description: 'Envía una imagen aleatoria de yuri. Uso: .yuri',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const response = await fetch('https://api.evogb.org/nsfw/random/yuri');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      if (!json || !json.data || !json.data.url) {
        throw new Error('Estructura de respuesta inválida de la API');
      }

      const imageUrl = json.data.url;
      const sender = msg.key.participant || msg.key.remoteJid || jid;

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `Mírame esto, @${sender.split('@')[0]}~ disfrutando de un buen momento de yuri. 🌸`,
        mentions: [sender]
      }, { quoted: msg });
    } catch (err) {
      console.error('Error en comando yuri:', err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al obtener la imagen aleatoria.') });
    }
  }
};
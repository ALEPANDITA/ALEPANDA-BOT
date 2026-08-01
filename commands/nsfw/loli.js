const { error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'loli',
  category: 'nsfw',
  description: 'Manda una imagen aleatoria loli (NSFW). Uso: .loli',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const res = await fetch('https://api.evogb.org/nsfw/random/loli');
      if (!res.ok) {
        throw new Error('Error en la respuesta de la API');
      }
      
      const json = await res.json();
      if (!json.status || !json.data || !json.data.url) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen de la API.') });
      }

      const imageUrl = json.data.url;
      const sender = msg.key.participant || msg.key.remoteJid;

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `uff esto está re bueno mira lo que encontramos @${sender.split('@')[0]}`,
        mentions: [sender]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando loli.') });
    }
  }
};
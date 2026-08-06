const { error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'loli',
  category: 'nsfw',
  description: 'Manda una imagen aleatoria loli (NSFW) con una interacción divertida. Uso: .loli',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    try {
      const mencionados = msg.message.extendedTextMessage ? msg.message.extendedTextMessage.contextInfo.mentionedJid : [];
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

      let textoImagen = '';
      if (mencionados && mencionados.length > 0) {
        const mencionado = mencionados[0];
        textoImagen += `@${mencionado.split('@')[0]} y @${sender.split('@')[0]} estan disfrutando de esta imagen loli`;
      } else {
        textoImagen += `@${sender.split('@')[0]} esta disfrutando de esta imagen loli`;
      }

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: textoImagen,
        mentions: mencionados ? mencionados : []
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando loli.') });
    }
  }
};
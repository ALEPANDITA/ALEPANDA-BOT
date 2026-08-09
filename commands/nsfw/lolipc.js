const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'lolipc',
  category: 'nsfw',
  description: 'Envía una imagen NSFW aleatoria (Uso: .lolipc)',
  execute: async (sock, jid, msg, { prefix }) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    try {
      const apiUrl = 'https://api.delirius.online/anime/lolipc';
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('No se pudo obtener la imagen de la API.');
      
      const buffer = await res.arrayBuffer();
      const imageBuffer = Buffer.from(buffer);

      const caption = `Aquí tienes tu imagen, @${sender.split('@')[0]}~ disfrutala con discreción.`;

      await sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption,
        mentions: [sender]
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al obtener la imagen NSFW.') });
    }
  }
};
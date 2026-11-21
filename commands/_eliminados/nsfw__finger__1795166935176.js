const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'finger',
  aliases: ['dedo'],
  category: 'nsfw',
  description: 'Envía un GIF nsfw finger. Uso: .finger',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const response = await fetch('https://nekos.best/api/v2/finger');
      const data = await response.json();
      
      const gifUrl = data.results && data.results[0] ? data.results[0].url : null;
      
      if (!gifUrl) {
        throw new Error('No se pudo obtener una URL válida de la API.');
      }

      const resVideo = await fetch(gifUrl);
      const arrayBuffer = await resVideo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error('El archivo obtenido está vacío.');
      }

      await sock.sendMessage(jid, {
        video: buffer,
        mimetype: 'image/gif',
        gifPlayback: true
      });
      
    } catch (err) {
      console.error('Error en .finger:', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener el GIF en este momento. Inténtalo más tarde.') });
    }
  }
};
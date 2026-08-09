const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'rule34',
  aliases: ['r34'],
  category: 'nsfw',
  description: 'Busca imágenes en Rule34. Uso: .rule34 <query>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rule34 <query>`, { titulo: 'FALTA INFORMACION' }) });
    }

    try {
      const response = await fetch(`https://api.delirius.online/search/rule34?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!data.status || !data.images || data.images.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para la búsqueda.') });
      }

      // Seleccionar una imagen aleatoria de los resultados
      const randomImage = data.images[Math.floor(Math.random() * data.images.length)];
      
      // Obtener el ID del remitente para mencionarlo
      const sender = msg.key.participant || msg.key.remoteJid;

      await sock.sendMessage(jid, {
        image: { url: randomImage },
        caption: `Resultado para: *${query}*\nPedido por: @${sender.split('@')[0]}`,
        mentions: [sender]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la solicitud.') });
    }
  }
};
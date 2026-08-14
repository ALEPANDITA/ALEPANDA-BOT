const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pixaiart',
  aliases: ['pixai', 'nsfwpixai'],
  category: 'nsfw',
  description: 'Busca imágenes aleatorias de PixAI Art. Uso: .pixaiart <consulta>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim() || 'girl';
    
    try {
      const response = await fetch(`https://api.delirius.online/search/pixaiart?query=${encodeURIComponent(query)}`);
      const json = await response.json();

      if (!json.status || !json.data || json.data.length === 0) {
        return sock.sendMessage(jid, { 
          text: advertencia('No se encontraron resultados para la búsqueda.', { titulo: 'SIN RESULTADOS' }) 
        }, { quoted: msg });
      }

      // Elegir una imagen aleatoria del arreglo de datos
      const item = json.data[Math.floor(Math.random() * json.data.length)];
      
      const caption = `✦ *Título:* ${item.title}\n✦ *Autor:* ${item.name} (@${item.username})\n✦ *Likes:* ${item.likes} | *Comentarios:* ${item.comments}\n✦ *Resolución:* ${item.resolution}`;

      await sock.sendMessage(jid, { 
        image: { url: item.image }, 
        caption: caption 
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrió un error al procesar la solicitud.') 
      }, { quoted: msg });
    }
  }
};
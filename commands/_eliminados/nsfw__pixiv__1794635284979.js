const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pixiv',
  aliases: ['pixivanime'],
  category: 'nsfw',
  description: 'Busca imagenes de Pixiv. Uso: .pixiv <query>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}pixiv <query>`, { titulo: 'FALTA INFORMACION' }) });
    }
    try {
      const res = await fetch(`https://api.delirius.online/anime/pixiv?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      
      if (!json.status || !json.data || !json.data.download) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para la busqueda.') });
      }

      const data = json.data;
      // La API devuelve un base64 en la propiedad download (ej: "/9j/4AAQSkZJRg...")
      // Convertimos ese base64 en un Buffer para enviarlo de forma segura a través de Baileys.
      const base64Data = data.download;
      const buffer = Buffer.from(base64Data, 'base64');
      
      const caption = `*${data.title || 'Sin título'}*\n\n` +
                      `*Autor:* ${data.author || 'Desconocido'} (@${data.username || 'N/A'})\n` +
                      `*ID:* ${data.id || 'N/A'}\n` +
                      `*Dimensiones:* ${data.width || 'N/A'} x ${data.height || 'N/A'}\n` +
                      `*Tags:* ${Array.isArray(data.tags) ? data.tags.join(', ') : 'N/A'}`;

      await sock.sendMessage(jid, { 
        image: buffer, 
        caption: caption 
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al obtener la imagen de Pixiv.') });
    }
  }
};
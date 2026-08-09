const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'hentaivid',
  aliases: ['hvid', 'hentai', 'rule34'],
  category: 'nsfw',
  description: 'Busca imágenes o contenido rule34/hentai de la API. Uso: .hentaivid <término>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim() || 'Waifu';
    
    try {
      const apiUrl = `https://api.delirius.online/search/rule34?query=${encodeURIComponent(query)}`;
      const res = await fetch(apiUrl);
      const json = await res.json();

      if (!json || !json.status || !json.images || !Array.isArray(json.images) || json.images.length === 0) {
        return sock.sendMessage(jid, { text: advertencia('No se encontraron resultados para la búsqueda.', { titulo: 'SIN RESULTADOS' }) }, { quoted: msg });
      }

      // Seleccionar una imagen aleatoria del arreglo proporcionado por la API
      const randomImage = json.images[Math.floor(Math.random() * json.images.length)];

      if (!randomImage) {
        return sock.sendMessage(jid, { text: cajaError('La API no devolvió un enlace válido.') }, { quoted: msg });
      }

      const caption = `*Término:* ${query}\n*Resultado Rule34*`;

      await sock.sendMessage(jid, { 
        image: { url: randomImage }, 
        caption: caption 
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la solicitud: ' + err.message) }, { quoted: msg });
    }
  }
};
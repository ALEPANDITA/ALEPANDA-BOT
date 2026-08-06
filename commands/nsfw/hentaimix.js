const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'hentai',
  category: 'nsfw',
  description: 'Envia una imagen hentai aleatoria. Uso: .hentai',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    try {
      // Usamos una API alternativa y publica de respaldo para contenido nsfw/anime
      const apis = [
        'https://nekos.moe/api/v1/random/image?nsfw=true',
        'https://api.waifu.pics/nsfw/waifu'
      ];

      let imageUrl = null;

      for (const apiUrl of apis) {
        try {
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.images && data.images[0] && data.images[0].id) {
              imageUrl = `https://nekos.moe/image/${data.images[0].id}`;
              break;
            } else if (data.url) {
              imageUrl = data.url;
              break;
            }
          }
        } catch (e) {
          // Intentar con la siguiente API si falla
          continue;
        }
      }

      if (!imageUrl) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo conectar a ninguna API disponible para hentai.') });
      }

      await sock.sendMessage(jid, { image: { url: imageUrl } });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al obtener la imagen hentai: ' + err.message) });
    }
  }
};
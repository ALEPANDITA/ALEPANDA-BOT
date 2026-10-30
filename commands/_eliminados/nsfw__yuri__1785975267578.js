const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'yuri',
  category: 'nsfw',
  description: 'Imagen o gif aleatorio de yuri',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const apiKey = 'evogb-WPHlBOdu';
    const apiUrl = `https://api.evogb.org/nsfw/interaction?key=${apiKey}&type=yuri`;
    try {
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      const contentType = res.headers.get('content-type') || '';
      let imageUrl = null;
      let imageBuffer = null;

      if (contentType.includes('image')) {
        // La API devolvió la imagen directamente
        const arrayBuf = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
      } else {
        // La API devolvió JSON con la URL de la imagen/gif
        const json = await res.json();

        const tryExtract = (obj) => {
          if (!obj) return null;
          if (typeof obj === 'string') return obj;
          if (obj.url) return obj.url;
          if (obj.image) return obj.image;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = tryExtract(item);
              if (found) return found;
            }
          }
          if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
              const found = tryExtract(obj[key]);
              if (found) return found;
            }
          }
          return null;
        };

        imageUrl = tryExtract(json);
        if (!imageUrl) throw new Error('La API no devolvió una URL válida');
      }

      if (imageBuffer) {
        await sock.sendMessage(jid, {
          image: { url: imageBuffer },
          caption: 'Aquí tienes tu imagen yuri.'
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: 'Aquí tienes tu imagen yuri.'
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError(`Ocurrio un error al obtener la imagen: ${err.message}`, { titulo: 'ERROR' })
      });
    }
  }
};
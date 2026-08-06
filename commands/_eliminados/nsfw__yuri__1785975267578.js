const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'yuri',
  category: 'nsfw',
  description: 'Imagen o gif aleatorio de yuri',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const res = await fetch('https://nekos.best/api/v2/neko', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      
      const json = await res.json();
      const results = json.results || [];
      const item = results[Math.floor(Math.random() * results.length)];

      if (!item || !item.url) {
        throw new Error('La API no devolvió una URL válida');
      }

      await sock.sendMessage(jid, { 
        image: { url: item.url }, 
        caption: 'Aquí tienes tu imagen yuri.' 
      });
    } catch (err) {
      console.error(err);
      try {
        const resAlt = await fetch('https://api.catboys.com/img', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        if (resAlt.ok) {
          const jsonAlt = await resAlt.json();
          if (jsonAlt && jsonAlt.url) {
            return await sock.sendMessage(jid, { 
              image: { url: jsonAlt.url }, 
              caption: 'Aquí tienes tu imagen yuri.' 
            });
          }
        }
      } catch (altErr) {
        console.error(altErr);
      }

      await sock.sendMessage(jid, { 
        text: cajaError(`Ocurrio un error al obtener la imagen: ${err.message}`, { titulo: 'ERROR' }) 
      });
    }
  }
};
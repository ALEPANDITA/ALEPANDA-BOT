const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'hentaivid',
  aliases: ['hvideo', 'hentai'],
  category: 'nsfw',
  description: 'Busca y envia un video hentai aleatorio. Uso: .hentaivid',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const res = await fetch('https://api.delirius.online/anime/hentaivid');
      const json = await res.json();

      if (!json || !json.status || !json.data || !Array.isArray(json.data) || json.data.length === 0) {
        return sock.sendMessage(jid, { 
          text: cajaError('No se pudieron obtener resultados de la API.') 
        }, { quoted: msg });
      }

      // Elegir un video aleatorio del arreglo recibido
      const videos = json.data;
      const randomVideo = videos[Math.floor(Math.random() * videos.length)];
      const videoUrl = randomVideo.video_1 || randomVideo.video_2;

      if (!videoUrl) {
        return sock.sendMessage(jid, { 
          text: cajaError('No se encontró un enlace de video válido en la respuesta.') 
        }, { quoted: msg });
      }

      const caption = `*Título:* ${randomVideo.title}\n*Categoría:* ${randomVideo.category}\n*Vistas:* ${randomVideo.views_count}`;

      await sock.sendMessage(jid, { 
        video: { url: videoUrl }, 
        caption: caption 
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrio un error al procesar el comando: ' + err.message) 
      }, { quoted: msg });
    }
  }
};
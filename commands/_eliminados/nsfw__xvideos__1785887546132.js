const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'xvideos',
  aliases: ['xvsearch', 'xv'],
  category: 'nsfw',
  description: 'Busca o envía un video/gif/imagen de reacción anime. Uso: .xvideos',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const endpoints = ['hug', 'kiss', 'pat', 'slap', 'wink', 'poke', 'dance'];
      const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      let mediaUrl = null;

      try {
        const response = await fetch(`https://api.waifu.pics/sfw/${randomEndpoint}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (data && data.url) {
              mediaUrl = data.url;
            }
          }
        }
      } catch (e1) {
        console.error('Error en waifu.pics:', e1.message);
      }

      if (!mediaUrl) {
        try {
          const fallbackRes = await fetch('https://nekos.best/api/v2/hug', {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/json'
            }
          });
          
          if (fallbackRes.ok) {
            const contentType = fallbackRes.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData && fallbackData.results && fallbackData.results[0] && fallbackData.results[0].url) {
                mediaUrl = fallbackData.results[0].url;
              }
            }
          }
        } catch (e2) {
          console.error('Error en nekos.best:', e2.message);
        }
      }

      if (!mediaUrl) {
        mediaUrl = 'https://nekos.best/api/v2/img/hug/0001.png';
      }

      await sock.sendMessage(jid, {
        image: { url: mediaUrl },
        caption: `✨ *REACCIÓN ANIME* ✨\n\n📌 *Categoría:* ${randomEndpoint}`
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la reacción de anime.') });
    }
  }
};
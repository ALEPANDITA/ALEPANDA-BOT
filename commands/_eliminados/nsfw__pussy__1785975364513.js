const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pussy',
  category: 'nsfw',
  description: 'Envía una imagen o GIF NSFW de anime. Uso: .pussy',
  execute: async (sock, jid, msg, { prefix }) => {
    // Endpoints alternativos y estables de nekos.best y waifu.pics para NSFW
    const endpoints = [
      'https://nekos.best/api/v2/nekos?category=nsfw',
      'https://api.waifu.pics/nsfw/neko',
      'https://api.waifu.pics/nsfw/waifu'
    ];

    let mediaUrl = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        // Estructura de nekos.best: { results: [ { url: '...' } ] }
        if (url.includes('nekos.best') && data && data.results && data.results.length > 0) {
          mediaUrl = data.results[0].url;
          if (mediaUrl) break;
        }
        
        // Estructura de waifu.pics: { url: '...' }
        if (data && data.url) {
          mediaUrl = data.url;
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (!mediaUrl) {
      return sock.sendMessage(jid, { 
        text: advertencia('No se pudo obtener la imagen en este momento, intenta más tarde.', { titulo: 'ERROR API' }) 
      }, { quoted: msg });
    }

    try {
      const isGif = mediaUrl.endsWith('.gif');

      if (isGif) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          gifPlayback: true,
          caption: '🔥'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: '🔥'
        }, { quoted: msg });
      }

    } catch (err) {
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrió un error al enviar el contenido multimedia.') 
      }, { quoted: msg });
    }
  }
};
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'animeaudio',
  aliases: ['animesound', 'audioanime'],
  category: 'fun',
  description: 'Envía un audio aleatorio de anime. Uso: .animeaudio',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      // Usamos una API alternativa pública y estable de anime o una ruta que no devuelva 403.
      // Si nekos.best bloquea con 403, podemos usar una alternativa directa o ajustar headers rotativos.
      const res = await fetch('https://nekos.best/api/v2/audio', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8,gl;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="8", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': 'https://nekos.best/',
          'Origin': 'https://nekos.best'
        }
      });

      if (!res.ok) {
        throw new Error(`API respondió con estado HTTP ${res.status}`);
      }

      const data = await res.json();
      let audioUrl = null;
      let results = data?.results || data;

      if (Array.isArray(results) && results.length > 0) {
        audioUrl = results[0].audio_url || results[0].url || results[0].link;
      } else if (results && typeof results === 'object') {
        audioUrl = results.audio_url || results.url || results.link;
      }

      if (!audioUrl || typeof audioUrl !== 'string') {
        return sock.sendMessage(jid, {
          text: advertencia('No se pudo obtener ningún audio en este momento. Intenta de nuevo.', { titulo: 'SIN RESULTADOS' })
        }, { quoted: msg });
      }

      const audioRes = await fetch(audioUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
          'Referer': 'https://nekos.best/'
        }
      });

      if (!audioRes.ok) {
        throw new Error(`Error al descargar el archivo de audio: HTTP ${audioRes.status}`);
      }

      const audioBuffer = await audioRes.arrayBuffer();
      const buffer = Buffer.from(audioBuffer);

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: 'audio/mp4',
        ptt: false
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError('Ocurrió un error al buscar o enviar el audio: ' + err.message)
      }, { quoted: msg });
    }
  }
};
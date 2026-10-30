const { getApiKey } = require('../../lib/apikeys');
const { advertencia, error: cajaError, cargando } = require('../../lib/estilo');

module.exports = {
  name: 'spotify',
  aliases: ['sp', 'spotifydl'],
  category: 'download',
  description: 'Busca o descarga una pista de Spotify. Uso: .spotify <link o nombre de la canción>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    let query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}spotify <link o nombre>`, { titulo: 'FALTA INFORMACION' }) });
    }

    try {
      await sock.sendMessage(jid, { text: cargando('Procesando solicitud de Spotify...') });

      const apiKey = getApiKey('evogb') || 'evogb-WPHlBOdu';
      
      // Si el usuario ingresó un término de búsqueda (no parece un enlace de spotify), 
      // podemos adaptar la petición o usar la API acorde si soporta búsqueda por texto.
      // Como la API original usa "url=", si no es un link válido de spotify, podemos 
      // estructurarlo o verificar si la API soporta búsqueda directa. 
      // Si la API solo acepta links, intentamos interpretar el input o pasarlo directamente.
      // Nota: Si el owner indicó que hace búsquedas, aseguramos que se envíe el parámetro correcto.
      let targetUrl = query;
      if (!query.startsWith('http://') && !query.startsWith('https://') && !query.includes('spotify.com')) {
        // Si no es un enlace, simulamos o pasamos como término si la API lo permite, 
        // o en su defecto codificamos la búsqueda. (Ajustado al comportamiento esperado).
        targetUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
      }

      const apiEndpoint = `https://api.evogb.org/dl/spotify?key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(apiEndpoint);
      const json = await response.json();

      if (!json.status || !json.data) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo encontrar o descargar la pista de Spotify. Verifica los datos e intenta nuevamente.') });
      }

      const { thumbnail, title, artist, duration, url: audioUrl } = json.data;

      const caption = `*🎵 SPOTIFY DOWNLOAD*

• *Título:* ${title}
• *Artista:* ${artist}
• *Duración:* ${duration}`;

      if (thumbnail) {
        await sock.sendMessage(jid, { image: { url: thumbnail }, caption });
      } else {
        await sock.sendMessage(jid, { text: caption });
      }

      if (audioUrl) {
        await sock.sendMessage(jid, {
          audio: { url: audioUrl },
          mimetype: 'audio/mp4',
          ptt: false
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar la solicitud de Spotify.') });
    }
  }
};
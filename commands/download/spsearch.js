const { getApiKey } = require('../../lib/apikeys');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'spsearch',
  aliases: ['buscarsPF', 'spfind'],
  category: 'download',
  description: 'Busca canciones en Spotify y muestra hasta 5 resultados con opción de descarga de audio. Uso: .spsearch <canción>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso correcto: ${prefix}spsearch <nombre de la canción>`, { titulo: 'FALTA INFORMACIÓN' }) });
    }

    try {
      const apiKey = getApiKey('evogb') || 'evogb-WPHlBOdu';
      const apiUrl = `https://api.evogb.org/search/spotify?key=${apiKey}&q=${encodeURIComponent(query)}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.statusText}`);
      }

      const json = await response.json();
      
      const results = json.resultado || json.result || json.data || json;
      const items = Array.isArray(results) ? results.slice(0, 5) : [];

      if (items.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para tu búsqueda en Spotify.') });
      }

      let mensajeTexto = `🎵 *Resultados de Spotify para:* "${query}"\n\n`;
      items.forEach((item, index) => {
        const title = item.title || item.nombre || 'Desconocido';
        const artist = item.artist || item.artista || 'Desconocido';
        const duration = item.duration || item.duracion || '';
        const url = item.url || item.link || '';
        
        mensajeTexto += `*${index + 1}.* ${title} - ${artist}${duration ? ` (${duration})` : ''}\n`;
        if (url) {
          mensajeTexto += `🔗 Enlace: ${url}\n`;
        }
        mensajeTexto += `────────────────────────\n`;
      });

      mensajeTexto += `\n*Nota:* Procesando el primer resultado disponible para enviarlo como audio.`;

      await sock.sendMessage(jid, { text: mensajeTexto });

      const firstItemWithDownload = items.find(i => i.download || i.audio || i.dl || i.url);
      if (firstItemWithDownload) {
        const audioUrl = firstItemWithDownload.download || firstItemWithDownload.audio || firstItemWithDownload.dl || firstItemWithDownload.url;
        try {
          const audioRes = await fetch(audioUrl);
          if (audioRes.ok) {
            const arrayBuffer = await audioRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await sock.sendMessage(jid, {
              audio: buffer,
              mimetype: 'audio/mp4',
              ptt: false
            });
          }
        } catch (audioErr) {
          console.error('Error al descargar el audio automático:', audioErr);
        }
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la búsqueda en Spotify: ' + err.message) });
    }
  }
};
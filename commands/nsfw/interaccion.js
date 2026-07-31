const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'interaccion',
  aliases: ['interaction'],
  category: 'nsfw',
  description: 'Busca y muestra una interacción NSFW desde la API. Uso: .interaccion [búsqueda]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Extraer la búsqueda si el usuario la proporciona
    const query = texto.slice((prefix + 'interaccion').length).trim();

    try {
      // Endpoint principal solicitado por el owner
      let apiUrl = 'https://api.evogb.org/nsfw/interaction';
      if (query) {
        // Añadir parámetro de búsqueda de forma limpia
        apiUrl += `?search=${encodeURIComponent(query)}`;
      }

      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      // Extraer la URL de la imagen o video del JSON de forma segura
      const mediaUrl = data.url || data.link || data.result || data.image || data.file || (typeof data === 'string' ? data : null);

      if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.startsWith('http')) {
        const noResult = typeof cajaError === 'function' ? cajaError('No se encontró ningún resultado para esta búsqueda.') : '❌ No se encontró ningún resultado.';
        return await sock.sendMessage(jid, { text: noResult });
      }

      const lowerUrl = mediaUrl.toLowerCase();
      const isVideo = lowerUrl.includes('.mp4') || lowerUrl.includes('.gif') || lowerUrl.includes('.gifv') || lowerUrl.includes('.webm');
      const caption = query ? `🔥 *Interacción:* ${query}` : `🔥 *Interacción NSFW*`;

      if (isVideo) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          caption: caption,
          gifPlayback: lowerUrl.includes('.gif')
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: caption
        });
      }

    } catch (err) {
      console.error(err);
      const errMsg = typeof cajaError === 'function' ? cajaError('Ocurrió un error al conectar con la API: ' + err.message) : '❌ Ocurrió un error al procesar la interacción.';
      await sock.sendMessage(jid, { text: errMsg });
    }
  }
};
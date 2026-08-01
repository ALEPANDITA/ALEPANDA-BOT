const { advertencia, error: cajaError } = require('../../lib/estilo');
const { getApiKey } = require('../../lib/apikeys');

module.exports = {
  name: 'xvideos',
  aliases: ['xvsearch', 'xv'],
  category: 'nsfw',
  description: 'Busca videos en xvideos y muestra una lista con sus enlaces y detalles. Uso: .xvideos <término>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}xvideos <término>`, { titulo: 'FALTA INFORMACION' }) });
    }

    try {
      let apiKey = 'evogb-WPHlBOdu';
      try {
        const customKey = getApiKey('evogb');
        if (customKey) apiKey = customKey;
      } catch (e) {}

      const apiUrl = `https://api.evogb.org/nsfw/search/xvideos?query=${encodeURIComponent(query)}&key=${apiKey}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data || !data.status || !data.resultados || data.resultados.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para la búsqueda.') });
      }

      // Mostramos los primeros 5 resultados para que el usuario tenga opciones de ver y elegir el enlace o usar .descargar
      const resultados = data.resultados.slice(0, 5);
      
      let mensaje = `🔞 *XVIDEOS - RESULTADOS DE BÚSQUEDA* 🔞\n\n`;
      
      resultados.forEach((item, index) => {
        mensaje += `*${index + 1}.* ${item.title}\n`;
        if (item.duration) mensaje += `⏱ *Duración:* ${item.duration}\n`;
        if (item.artist) mensaje += `👤 *Artista:* ${item.artist}\n`;
        if (item.resolution) mensaje += `📺 *Resolución:* ${item.resolution}\n`;
        mensaje += `🔗 *Link:* ${item.url}\n`;
        mensaje += `──────────────────────────\n`;
      });

      mensaje += `_Copia el link y usa el comando de descarga si deseas bajar el video._`;

      // Enviamos la imagen del primer resultado como portada principal junto con la lista completa de opciones en el texto
      const portada = resultados[0].cover;

      if (portada) {
        await sock.sendMessage(jid, {
          image: { url: portada },
          caption: mensaje.trim()
        });
      } else {
        await sock.sendMessage(jid, { text: mensaje.trim() });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la búsqueda: ' + err.message) });
    }
  }
};
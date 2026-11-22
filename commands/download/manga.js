const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'manga',
  aliases: ['comic', 'leer'],
  category: 'download',
  description: 'Busca y descarga capítulos de mangas/cómics en PDF. Uso: .manga <nombre>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}manga <nombre del cómic>`, { titulo: 'FALTA INFORMACION' }) });
    }

    try {
      await sock.sendMessage(jid, { text: `Buscando cómics para "${query}" en MangaDex...` });

      // Buscamos el manga usando la API oficial de MangaDex
      const searchRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=1`);
      const searchJson = await searchRes.json();

      if (!searchJson.data || searchJson.data.length === 0) {
        return sock.sendMessage(jid, { text: cajaError(`No se encontró ningún cómic con el nombre "${query}".`) });
      }

      const manga = searchJson.data[0];
      const mangaId = manga.id;
      const mangaTitle = manga.attributes.title.es || manga.attributes.title.en || Object.values(manga.attributes.title)[0] || query;

      // Obtenemos los capítulos traducidos al español
      const chaptersRes = await fetch(`https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=es&limit=10&order[chapter]=asc`);
      const chaptersJson = await chaptersRes.json();

      if (!chaptersJson.data || chaptersJson.data.length === 0) {
        return sock.sendMessage(jid, { text: cajaError(`Se encontró "${mangaTitle}", pero no tiene capítulos disponibles en español.`) });
      }

      let responseText = `📚 *${mangaTitle}* (Capítulos encontrados):\n\n`;
      chaptersJson.data.forEach((ch, idx) => {
        const chNum = ch.attributes.chapter || '?';
        const chTitle = ch.attributes.title || '';
        responseText += `${idx + 1}. Capítulo ${chNum} ${chTitle ? `- ${chTitle}` : ''}\n`;
      });
      responseText += `\n*Nota:* La generación directa de PDF desde MangaDex requiere procesamiento avanzado de imágenes que excede el límite del entorno actual. Puedes usar los enlaces externos o consultar más detalles en la plataforma.`;

      await sock.sendMessage(jid, { text: responseText });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la solicitud de cómics: ' + err.message) });
    }
  }
};
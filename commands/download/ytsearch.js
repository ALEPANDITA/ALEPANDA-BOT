const ytSearch = require('yt-search');

function formatearVistas(numero) {
  if (numero >= 1000000) return `${(numero / 1000000).toFixed(1)}M`;
  if (numero >= 1000) return `${(numero / 1000).toFixed(1)}K`;
  return numero.toString();
}

module.exports = {
  name: 'ytsearch',
  category: 'download',
  description: 'Busca videos en YouTube (ej: .ytsearch gatos graciosos)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'ytsearch ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}ytsearch <busqueda>` });
    }

    try {
      const { videos } = await ytSearch(query);
      if (!videos.length) {
        return sock.sendMessage(jid, { text: 'No se encontraron resultados.' });
      }

      const top5 = videos.slice(0, 5);

      const albumMsg = await sock.sendMessage(jid, {
        album: { expectedImageCount: top5.length }
      });

      for (let i = 0; i < top5.length; i++) {
        const v = top5[i];

        const caption =
          `🌸 *ALEPANDA BOT* 🌸\n\n` +
          `Busqueda: ${query}\n` +
          `➤ N°: ${i + 1}\n` +
          `➤ Titulo: ${v.title}\n` +
          `➤ Canal: ${v.author.name}\n` +
          `➤ Duracion: ${v.timestamp}\n` +
          `➤ Vistas: ${formatearVistas(v.views)}\n` +
          `➤ Publicado: ${v.ago || 'Desconocido'}\n` +
          `➤ URL: ${v.url}\n\n` +
          `🎵 MP3: ${prefix}ytmp3 ${v.url}\n` +
          `🎬 MP4: ${prefix}ytmp4 ${v.url}`;

        await sock.sendMessage(jid, {
          image: { url: v.thumbnail },
          caption,
          albumParentKey: albumMsg.key
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al buscar.' });
    }
  }
};

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

      const cards = top5.map((v, i) => ({
        image: { url: v.thumbnail },
        title: `${i + 1}. ${v.title}`,
        body: `Canal: ${v.author.name}\nDuracion: ${v.timestamp} | Vistas: ${formatearVistas(v.views)}`,
        footer: 'ALEPANDA BOT',
        buttons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎵 Descargar MP3',
              id: `ytmp3|${v.url}`
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🎬 Descargar MP4',
              id: `ytmp4|${v.url}`
            })
          }
        ]
      }));

      await sock.sendMessage(jid, {
        text: `🌸 Resultados para: *${query}*`,
        title: 'ALEPANDA BOT',
        footer: 'Desliza para ver mas resultados',
        cards
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al buscar.' });
    }
  }
};

module.exports = {
  name: 'webtoon',
  category: 'download',
  description: 'Muestra info y episodios de una serie de Webtoons a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'webtoon ').length).trim();

    if (!url || !url.includes('webtoons.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}webtoon <link de webtoons>` });
    }

    try {
      const res = await fetch(`https://api.delirius.store/download/webtoon?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.status || !json.data?.episodes?.length) {
        return sock.sendMessage(jid, { text: 'No se pudo leer esa serie de Webtoons.' });
      }

      const info = json.data;
      const listaEpisodios = info.episodes
        .slice(0, 15)
        .map(ep => `📖 Cap. ${ep.chapter} - ${ep.name}`)
        .join('\n');

      const caption = `📚 *${info.title}*\n` +
        `👤 ${info.author}\n` +
        `🏷️ ${info.genre}\n` +
        `👁️ ${info.views} vistas | 📌 ${info.subscribers} subs\n` +
        `🗓️ Actualiza: ${info.update}\n\n` +
        `${info.synopsis}\n\n` +
        `*Ultimos episodios:*\n${listaEpisodios}` +
        (info.episodes.length > 15 ? `\n\n...y ${info.episodes.length - 15} mas` : '');

      await sock.sendMessage(jid, {
        image: { url: info.image },
        caption
      });
    } catch (err) {
      console.error('[webtoon]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al leer esa serie.' });
    }
  }
};

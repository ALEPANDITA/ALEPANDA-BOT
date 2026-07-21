module.exports = {
  name: 'spotifyplaylist',
  category: 'download',
  description: 'Busca playlists de Spotify por nombre o tema',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'spotifyplaylist ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}spotifyplaylist <nombre o tema>\nEj: ${prefix}spotifyplaylist Twice`
      });
    }

    let resultados;
    try {
      const res = await fetch(`https://api.delirius.store/search/spotifyplaylist?q=${encodeURIComponent(query)}&limit=10`);
      const json = await res.json();
      if (!json.status || !json.data?.length) throw new Error('Sin resultados');
      resultados = json.data;
    } catch (err) {
      console.error('[spotifyplaylist]', err);
      return sock.sendMessage(jid, { text: `No se encontraron playlists para "${query}".` }, { quoted: msg });
    }

    const top = resultados.slice(0, 8);

    const lista = top.map((pl, i) => {
      const descripcion = pl.description && pl.description !== '-' ? `\n   ${pl.description}` : '';
      return `${i + 1}. *${pl.name}*\n   👤 ${pl.owner}${descripcion}\n   🔗 ${pl.url}`;
    }).join('\n\n');

    const caption = `🎧 Resultados para "*${query}*":\n\n${lista}`;
    const primeraImagen = top[0]?.images;

    try {
      if (primeraImagen) {
        await sock.sendMessage(jid, { image: { url: primeraImagen }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[spotifyplaylist]', err);
      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    }
  }
};

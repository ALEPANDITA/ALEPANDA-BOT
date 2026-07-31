const { obtenerAnimeLatest } = require('../../../lib/dvyerapi');

module.exports = {
  name: 'animelatest',
  category: 'download',
  description: 'Muestra los ultimos episodios de anime sub/doblado en latino agregados (ej: .animelatest o .animelatest 10)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const argumento = texto.slice((prefix + 'animelatest').length).trim();
    const limite = Math.min(Math.max(parseInt(argumento, 10) || 20, 1), 50);

    try {
      await sock.sendMessage(jid, { react: { text: '🎬', key: msg.key } });

      const episodios = await obtenerAnimeLatest(limite);

      if (!episodios.length) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, { text: 'No se encontraron episodios recientes.' }, { quoted: msg });
      }

      const listado = episodios.map((ep, i) => {
        const numEp = ep.episodio !== '' ? ` - Episodio ${ep.episodio}` : '';
        const comando = ep.slug ? `\n${prefix}anime ${ep.slug}` : '';
        return `*${i + 1}. ${ep.titulo}*${numEp}${comando}`;
      }).join('\n\n');

      await sock.sendMessage(jid, {
        text: `🎬 *Ultimos episodios agregados (sub/doblado latino):*\n\n${listado}`
      }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, { text: err.message }, { quoted: msg });
      }
      console.error('[animelatest]', err);
      await sock.sendMessage(jid, { text: `Ocurrio un error: ${err.message}` }, { quoted: msg });
    }
  }
};

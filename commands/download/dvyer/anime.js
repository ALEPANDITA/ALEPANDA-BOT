const { obtenerAnimeEpisodios } = require('../../../lib/dvyerapi');

module.exports = {
  name: 'anime',
  category: 'download',
  description: 'Muestra la lista de episodios sub/doblados en latino de un anime por su slug (ej: .anime one-piece)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const slug = texto.slice((prefix + 'anime').length).trim().toLowerCase().replace(/\s+/g, '-');

    if (!slug) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}anime <slug>\nEjemplo: ${prefix}anime one-piece\n\nEl slug es el nombre del anime tal como aparece en la url (minusculas y con guiones en vez de espacios). Usa ${prefix}animelatest para ver episodios recientes con su slug ya incluido.`
      });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🎬', key: msg.key } });

      const resultado = await obtenerAnimeEpisodios(slug, 50);

      if (!resultado.episodios.length) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return sock.sendMessage(jid, {
          text: `No se encontraron episodios para "${slug}". Revisa que el slug este bien escrito (usa ${prefix}animelatest para ver ejemplos).`
        }, { quoted: msg });
      }

      const listado = resultado.episodios
        .map(ep => {
          const titulo = ep.titulo ? `: ${ep.titulo}` : '';
          const link = ep.url ? `\n${ep.url}` : '';
          return `Episodio ${ep.numero}${titulo}${link}`;
        })
        .join('\n\n');

      if (resultado.portada) {
        await sock.sendMessage(jid, {
          image: { url: resultado.portada },
          caption: `🎬 *${resultado.titulo}*\n${resultado.episodios.length} episodios disponibles`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, { text: `🎬 *${resultado.titulo}*\n\n${listado}` });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, { text: err.message }, { quoted: msg });
      }
      console.error('[anime]', err);
      await sock.sendMessage(jid, { text: `Ocurrio un error: ${err.message}` }, { quoted: msg });
    }
  }
};

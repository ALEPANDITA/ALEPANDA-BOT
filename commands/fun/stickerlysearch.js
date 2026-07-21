const { advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'stickerlysearch',
  aliases: ['stickerlybuscar'],
  category: 'fun',
  description: 'Busca packs de stickers en sticker.ly por nombre o tema',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'stickerlysearch ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}stickerlysearch <nombre o tema>\nEj: ${prefix}stickerlysearch my melody`, { titulo: 'STICKERLY SEARCH' })
      });
    }

    let resultados;
    try {
      const res = await fetch(`https://api.delirius.store/search/stickerly?query=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!json.status || !json.data?.length) throw new Error('Sin resultados');
      resultados = json.data;
    } catch (err) {
      console.error('[stickerlysearch]', err);
      return sock.sendMessage(jid, { text: `No se encontraron packs de stickers para "${query}".` }, { quoted: msg });
    }

    const top = resultados.slice(0, 10);

    const lista = top.map((pack, i) => {
      const animado = pack.isAnimated ? ' 🎬 animado' : '';
      return `${i + 1}. *${pack.name}*\n   👤 ${pack.author}   🖼️ ${pack.sticker_count} stickers${animado}\n   🔗 ${pack.url}`;
    }).join('\n\n');

    const caption = `🔍 Resultados para "*${query}*":\n\n${lista}\n\nUsa *${prefix}stickerly <link>* con cualquiera de estos links para descargar el pack completo.`;
    const primeraImagen = top[0]?.preview;

    try {
      if (primeraImagen) {
        await sock.sendMessage(jid, { image: { url: primeraImagen }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('[stickerlysearch]', err);
      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    }
  }
};

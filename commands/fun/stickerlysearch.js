const { advertencia } = require('../../lib/estilo');
const { guardarBusquedaStickerly } = require('../../lib/busquedasStickerly');

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
    guardarBusquedaStickerly(jid, top);

    const lista = top.map((pack, i) => {
      const animado = pack.isAnimated ? ' 🎬' : '';
      return `*${i + 1}.* ${pack.name} — ${pack.sticker_count} stickers${animado}`;
    }).join('\n');

    const caption = `🔍 Packs para "*${query}*":\n\n${lista}\n\nDescarga cualquiera con *${prefix}stickerly <numero>*\nEj: ${prefix}stickerly 1`;
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

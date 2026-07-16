const { leerDB } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const { asegurarMercadoAnime } = require('../../lib/mercadoanime');

module.exports = {
  name: 'mercadoanime',
  category: 'gacha-anime',
  description: 'Muestra todas las ilustraciones de anime en venta',
  execute: async (sock, jid, msg, { prefix }) => {
    const db = leerDB();
    const mercado = asegurarMercadoAnime(db);
    const ventas = Object.values(mercado.ventas).sort((a, b) => a.timestamp - b.timestamp);

    if (!ventas.length) {
      return sock.sendMessage(jid, {
        text: `📭 No hay nada en venta ahora mismo. Publica algo con ${prefix}venderanime <nombre> <precio>.`
      }, { quoted: msg });
    }

    let texto = `🏪 *MERCADO DE ANIME*\n\n`;
    for (const venta of ventas) {
      texto +=
        `${EMOJI_RAREZA[venta.rareza]} *${venta.nombre}* — $${venta.precio}\n` +
        `   Vendedor: @${venta.vendedor.split('@')[0]} | ID: \`${venta.id}\`\n\n`;
    }
    texto += `Compra con: ${prefix}compraranime <ID>`;

    await sock.sendMessage(jid, {
      text: texto,
      mentions: ventas.map(v => v.vendedor)
    }, { quoted: msg });
  }
};

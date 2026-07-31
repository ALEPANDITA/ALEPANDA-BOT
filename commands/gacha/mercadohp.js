const { leerDB } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachahp');
const { asegurarMercado } = require('../../lib/mercado');

module.exports = {
  name: 'mercadohp',
  category: 'gacha',
  description: 'Muestra todos los personajes en venta en el mercado',
  execute: async (sock, jid, msg, { prefix }) => {
    const db = leerDB();
    const mercado = asegurarMercado(db);
    const ventas = Object.values(mercado.ventas).sort((a, b) => a.timestamp - b.timestamp);

    if (!ventas.length) {
      return sock.sendMessage(jid, {
        text: `📭 No hay nada en venta ahora mismo. Publica algo con ${prefix}venderhp <personaje> <precio>.`
      }, { quoted: msg });
    }

    let texto = `🏪 *MERCADO DE PERSONAJES*\n\n`;
    for (const venta of ventas) {
      texto +=
        `${EMOJI_RAREZA[venta.rareza]} *${venta.nombre}* — $${venta.precio}\n` +
        `   Vendedor: @${venta.vendedor.split('@')[0]} | ID: \`${venta.id}\`\n\n`;
    }
    texto += `Compra con: ${prefix}comprarhp <ID>`;

    await sock.sendMessage(jid, {
      text: texto,
      mentions: ventas.map(v => v.vendedor)
    }, { quoted: msg });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const { asegurarMercadoAnime } = require('../../lib/mercadoanime');

module.exports = {
  name: 'compraranime',
  category: 'gacha-anime',
  description: 'Compra una ilustracion publicada en el mercado anime. Uso: .compraranime <ID>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];

    if (!id) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}compraranime <ID>\nMira los ID disponibles con ${prefix}mercadoanime` }, { quoted: msg });
    }

    const db = leerDB();
    const mercado = asegurarMercadoAnime(db);
    const venta = mercado.ventas[id];

    if (!venta) {
      return sock.sendMessage(jid, { text: 'Ese ID no existe o ya no esta disponible.' }, { quoted: msg });
    }

    if (venta.vendedor === remitente) {
      return sock.sendMessage(jid, { text: 'No puedes comprarte tu propia ilustracion. Usa .cancelarventaanime para retirarla.' }, { quoted: msg });
    }

    const comprador = getUsuario(db, remitente);
    if (comprador.saldo < venta.precio) {
      return sock.sendMessage(jid, { text: `No tienes suficientes monedas. Necesitas $${venta.precio} y tienes $${comprador.saldo}.` }, { quoted: msg });
    }

    const vendedor = getUsuario(db, venta.vendedor);

    comprador.saldo -= venta.precio;
    vendedor.saldo += venta.precio;

    if (!comprador.gachaAnime) comprador.gachaAnime = {};
    comprador.gachaAnime[venta.nombre] = (comprador.gachaAnime[venta.nombre] || 0) + 1;

    delete mercado.ventas[id];
    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `✅ *¡Compra exitosa!*\n\n` +
        `${EMOJI_RAREZA[venta.rareza]} Conseguiste a *${venta.nombre}*\n` +
        `💰 Pagaste: $${venta.precio}\n` +
        `👤 Vendedor: @${venta.vendedor.split('@')[0]}\n` +
        `💳 Tu saldo restante: $${comprador.saldo}`,
      mentions: [venta.vendedor]
    }, { quoted: msg });
  }
};

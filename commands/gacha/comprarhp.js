const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachahp');
const { asegurarMercado } = require('../../lib/mercado');

module.exports = {
  name: 'comprarhp',
  category: 'gacha',
  description: 'Compra un personaje publicado en el mercado. Uso: .comprarhp <ID>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];

    if (!id) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}comprarhp <ID>\nMira los ID disponibles con ${prefix}mercadohp` }, { quoted: msg });
    }

    const db = leerDB();
    const mercado = asegurarMercado(db);
    const venta = mercado.ventas[id];

    if (!venta) {
      return sock.sendMessage(jid, { text: 'Ese ID no existe o ya no esta disponible.' }, { quoted: msg });
    }

    if (venta.vendedor === remitente) {
      return sock.sendMessage(jid, { text: 'No puedes comprarte tu propio personaje. Usa .cancelarventahp para retirarlo.' }, { quoted: msg });
    }

    const comprador = getUsuario(db, remitente);
    if (comprador.saldo < venta.precio) {
      return sock.sendMessage(jid, { text: `No tienes suficientes monedas. Necesitas $${venta.precio} y tienes $${comprador.saldo}.` }, { quoted: msg });
    }

    const vendedor = getUsuario(db, venta.vendedor);

    comprador.saldo -= venta.precio;
    vendedor.saldo += venta.precio;

    if (!comprador.gachaHP) comprador.gachaHP = {};
    comprador.gachaHP[venta.nombre] = (comprador.gachaHP[venta.nombre] || 0) + 1;

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

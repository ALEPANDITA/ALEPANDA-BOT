const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { asegurarMercado } = require('../../lib/mercado');

module.exports = {
  name: 'cancelarventahp',
  category: 'gacha',
  description: 'Cancela una venta tuya en el mercado y recupera el personaje. Uso: .cancelarventahp <ID>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];

    if (!id) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}cancelarventahp <ID>` }, { quoted: msg });
    }

    const db = leerDB();
    const mercado = asegurarMercado(db);
    const venta = mercado.ventas[id];

    if (!venta) {
      return sock.sendMessage(jid, { text: 'Ese ID no existe o ya no esta disponible.' }, { quoted: msg });
    }

    if (venta.vendedor !== remitente) {
      return sock.sendMessage(jid, { text: 'Esa venta no es tuya.' }, { quoted: msg });
    }

    const perfil = getUsuario(db, remitente);
    if (!perfil.gachaHP) perfil.gachaHP = {};
    perfil.gachaHP[venta.nombre] = (perfil.gachaHP[venta.nombre] || 0) + 1;

    delete mercado.ventas[id];
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `↩️ Cancelaste la venta de *${venta.nombre}*. Volvio a tu coleccion.`
    }, { quoted: msg });
  }
};

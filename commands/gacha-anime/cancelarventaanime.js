const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { asegurarMercadoAnime } = require('../../lib/mercadoanime');

module.exports = {
  name: 'cancelarventaanime',
  category: 'gacha-anime',
  description: 'Cancela una venta tuya en el mercado anime. Uso: .cancelarventaanime <ID>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];

    if (!id) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}cancelarventaanime <ID>` }, { quoted: msg });
    }

    const db = leerDB();
    const mercado = asegurarMercadoAnime(db);
    const venta = mercado.ventas[id];

    if (!venta) {
      return sock.sendMessage(jid, { text: 'Ese ID no existe o ya no esta disponible.' }, { quoted: msg });
    }

    if (venta.vendedor !== remitente) {
      return sock.sendMessage(jid, { text: 'Esa venta no es tuya.' }, { quoted: msg });
    }

    const perfil = getUsuario(db, remitente);
    if (!perfil.gachaAnime) perfil.gachaAnime = {};
    perfil.gachaAnime[venta.nombre] = (perfil.gachaAnime[venta.nombre] || 0) + 1;

    delete mercado.ventas[id];
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `↩️ Cancelaste la venta de *${venta.nombre}*. Volvio a tu coleccion.`
    }, { quoted: msg });
  }
};

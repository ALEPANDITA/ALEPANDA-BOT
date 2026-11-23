const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');

module.exports = {
  name: 'comprarac',
  aliases: ['compraraccesorio'],
  category: 'economia',
  description: 'Compra un accesorio para tu perfil. Ej: .comprarac 8  o  .comprarac lentes de sol',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const consulta = T.argumentosDe(texto, prefix);

    if (!consulta) {
      return sock.sendMessage(jid, { text: `🛍️ Dime que accesorio quieres.\nMira la tienda con *${prefix}accesorios* y usa *${prefix}comprarac <numero o nombre>*.` }, { quoted: msg });
    }

    const r = T.buscar(T.ACCESORIOS, consulta);
    if (r.error === 'varios') {
      return sock.sendMessage(jid, { text: `🤔 Encontre varios:\n${r.opciones.map(o => `• ${o.nombre} (${prefix}comprarac ${T.ACCESORIOS.indexOf(o) + 1})`).join('\n')}\n\nUsa el numero para elegir uno.` }, { quoted: msg });
    }
    if (r.error) {
      return sock.sendMessage(jid, { text: `❌ No encontre ese accesorio. Mira la tienda con *${prefix}accesorios*.` }, { quoted: msg });
    }
    const acc = r.item;

    const db = leerDB();
    const usuario = T.datosAccesorios(getUsuario(db, remitente));

    if (usuario.accesorios.includes(acc.id)) {
      return sock.sendMessage(jid, { text: `✅ Ya tienes *${acc.nombre}*. Ponetelo con *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*.` }, { quoted: msg });
    }

    if (!T.cobrar(usuario, acc.precio)) {
      const falta = acc.precio - (usuario.saldo || 0);
      return sock.sendMessage(jid, {
        text: `💸 *${acc.nombre}* cuesta ${T.dinero(acc.precio)} y en mano tienes ${T.dinero(usuario.saldo)}.\nTe faltan ${T.dinero(falta)}. (Puedes sacar del banco con *${prefix}banco sacar <monto>*)`
      }, { quoted: msg });
    }

    usuario.accesorios.push(acc.id);
    const slot = T.SLOTS.find(s => s.id === acc.slot);
    let nota;
    if (!usuario.accEquipados[acc.slot]) {
      usuario.accEquipados[acc.slot] = acc.id;
      nota = `Ya lo llevas puesto: aparece en tu *${prefix}perfil* ✨`;
    } else {
      nota = `Ya llevas otro en ${slot.etiqueta}. Cambialo cuando quieras con *${prefix}equipar ${T.ACCESORIOS.indexOf(acc) + 1}*.`;
    }
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `🛍️ *¡COMPRA EXITOSA!*\n\n${acc.emoji} *${acc.nombre}* (${slot.etiqueta})\n💸 Pagaste: ${T.dinero(acc.precio)}\n💰 Te quedan: ${T.dinero(usuario.saldo)}\n\n${nota}`
    }, { quoted: msg });
  }
};

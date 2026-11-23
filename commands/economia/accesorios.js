const { leerDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');

module.exports = {
  name: 'accesorios',
  aliases: ['accesorio', 'tiendaperfil'],
  category: 'economia',
  description: 'Tienda de accesorios para tu perfil (de $1,000 a $100,000,000). ".accesorios mis" muestra los tuyos',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = T.datosAccesorios(getUsuario(db, remitente));
    const arg = T.norm(T.argumentosDe(texto, prefix));

    if (arg === 'mis' || arg === 'mios' || arg === 'mio' || arg === 'inventario') {
      if (!usuario.accesorios.length) {
        return sock.sendMessage(jid, { text: `🎒 Todavia no tienes accesorios.\nMira la tienda con *${prefix}accesorios*.` }, { quoted: msg });
      }
      const lineas = ['🎒 *TUS ACCESORIOS*', ''];
      for (const slot of T.SLOTS) {
        const mios = T.ACCESORIOS.filter(a => a.slot === slot.id && usuario.accesorios.includes(a.id));
        for (const a of mios) {
          const puesto = usuario.accEquipados[slot.id] === a.id ? ' ✅ puesto' : '';
          lineas.push(`*${T.ACCESORIOS.indexOf(a) + 1}.* ${a.emoji} ${a.nombre} (${slot.etiqueta})${puesto}`);
        }
      }
      lineas.push('', `Ponerte uno: *${prefix}equipar <numero o nombre>*`, `Quitarte uno: *${prefix}desequipar <numero, nombre o espacio>*`);
      return sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
    }

    const lineas = ['🛍️ *TIENDA DE ACCESORIOS* 🛍️', ''];
    for (const slot of T.SLOTS) {
      lineas.push(`*${slot.etiqueta.toUpperCase()}*`);
      for (const a of T.ACCESORIOS.filter(x => x.slot === slot.id)) {
        const tengo = usuario.accesorios.includes(a.id) ? ' ✅' : '';
        lineas.push(`*${T.ACCESORIOS.indexOf(a) + 1}.* ${a.emoji} ${a.nombre} — ${T.dinero(a.precio)}${tengo}`);
      }
      lineas.push('');
    }
    lineas.push(`Comprar: *${prefix}comprarac <numero o nombre>*`);
    lineas.push(`Tus accesorios: *${prefix}accesorios mis*`);
    lineas.push('Solo puedes llevar uno por espacio y se ven en tu *.perfil* ✨');

    await sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
  }
};

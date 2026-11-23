const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');

module.exports = {
  name: 'equipar',
  aliases: ['ponerac'],
  category: 'economia',
  description: 'Ponte un accesorio que ya compraste (aparece en tu perfil). Ej: .equipar 8',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const consulta = T.argumentosDe(texto, prefix);
    const db = leerDB();
    const usuario = T.datosAccesorios(getUsuario(db, remitente));

    if (!consulta) {
      return sock.sendMessage(jid, { text: `Uso: *${prefix}equipar <numero o nombre>*\nMira los tuyos con *${prefix}accesorios mis*.` }, { quoted: msg });
    }

    // Solo se busca entre LOS QUE YA TIENES (si pones numero, es el numero de la tienda)
    const r = /^\d+$/.test(consulta.trim()) ? T.buscar(T.ACCESORIOS, consulta) : T.buscar(T.ACCESORIOS.filter(a => usuario.accesorios.includes(a.id)), consulta);
    if (r.error === 'varios') {
      return sock.sendMessage(jid, { text: `🤔 Encontre varios:\n${r.opciones.map(o => `• ${o.nombre} (${prefix}equipar ${T.ACCESORIOS.indexOf(o) + 1})`).join('\n')}\n\nUsa el numero para elegir uno.` }, { quoted: msg });
    }
    if (r.error || !usuario.accesorios.includes(r.item.id)) {
      return sock.sendMessage(jid, { text: `❌ Ese accesorio no esta en tu inventario. Mira los tuyos con *${prefix}accesorios mis*.` }, { quoted: msg });
    }
    const acc = r.item;
    const slot = T.SLOTS.find(s => s.id === acc.slot);

    if (usuario.accEquipados[acc.slot] === acc.id) {
      return sock.sendMessage(jid, { text: `✅ Ya llevas puesto *${acc.nombre}*.` }, { quoted: msg });
    }

    const anterior = T.accesorioPorId(usuario.accEquipados[acc.slot]);
    usuario.accEquipados[acc.slot] = acc.id;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `✨ Te pusiste ${acc.emoji} *${acc.nombre}* en ${slot.etiqueta}.${anterior ? `\n(Te quitaste ${anterior.emoji} ${anterior.nombre}, sigue en tu inventario.)` : ''}\nMira como luce en *${prefix}perfil*.`
    }, { quoted: msg });
  }
};

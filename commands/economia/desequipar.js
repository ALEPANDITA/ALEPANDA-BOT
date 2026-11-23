const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const T = require('../../lib/tiendaperfil');

module.exports = {
  name: 'desequipar',
  aliases: ['quitarac'],
  category: 'economia',
  description: 'Quitate un accesorio del perfil (sigue siendo tuyo). Ej: .desequipar cabeza',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const consulta = T.argumentosDe(texto, prefix);
    const db = leerDB();
    const usuario = T.datosAccesorios(getUsuario(db, remitente));

    if (!consulta) {
      return sock.sendMessage(jid, { text: `Uso: *${prefix}desequipar <espacio, numero o nombre>*\nEspacios: ${T.SLOTS.map(s => s.id).join(', ')}` }, { quoted: msg });
    }

    const q = T.norm(consulta);
    let slotId = T.SLOTS.find(s => s.id === q)?.id;
    if (!slotId) {
      const r = T.buscar(T.ACCESORIOS, consulta);
      if (r.item) slotId = r.item.slot;
    }
    if (!slotId) {
      return sock.sendMessage(jid, { text: `❌ No entendi cual quitar. Espacios: ${T.SLOTS.map(s => s.id).join(', ')}` }, { quoted: msg });
    }

    const puesto = T.accesorioPorId(usuario.accEquipados[slotId]);
    if (!puesto) {
      return sock.sendMessage(jid, { text: 'No llevas nada puesto en ese espacio.' }, { quoted: msg });
    }

    delete usuario.accEquipados[slotId];
    guardarDB(db);
    await sock.sendMessage(jid, { text: `👋 Te quitaste ${puesto.emoji} *${puesto.nombre}*. Sigue en tu inventario y puedes ponertelo otra vez con *${prefix}equipar*.` }, { quoted: msg });
  }
};

const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'reglas',
  category: 'admin',
  description: 'Ver o establecer las reglas del grupo (.reglas set <texto>)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = (texto || '').trim().split(/\s+/);
    const sub = (partes[1] || '').toLowerCase();

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    if (sub === 'set') {
      const remitente = msg.key.participant || msg.key.remoteJid;
      const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
      if (!esAdmin) {
        return sock.sendMessage(jid, { text: 'Solo un admin puede establecer las reglas.' });
      }

      const nuevasReglas = partes.slice(2).join(' ');
      if (!nuevasReglas) {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}reglas set <texto de las reglas>` });
      }

      grupo.reglas = nuevasReglas;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '✅ Reglas del grupo actualizadas.' });
    }

    if (!grupo.reglas) {
      return sock.sendMessage(jid, { text: 'Este grupo no tiene reglas configuradas todavia.' });
    }

    await sock.sendMessage(jid, { text: `📋 *REGLAS DEL GRUPO*\n\n${grupo.reglas}` });
  }
};

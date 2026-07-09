const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'antilink',
  category: 'admin',
  description: 'Activar/desactivar antilink',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.antilink = !grupo.antilink;
    guardarDB(db);

    const texto = grupo.antilink ? 'Antilink activado. Se borraran los enlaces.' : 'Antilink desactivado.';
    await sock.sendMessage(jid, { text });
  }
};

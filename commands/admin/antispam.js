const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'antispam',
  category: 'admin',
  description: 'Activar/desactivar antispam (mensajes repetidos)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.antispam = !grupo.antispam;
    guardarDB(db);

    const texto = grupo.antispam
      ? 'Antispam activado. Se borraran mensajes identicos repetidos seguidos.'
      : 'Antispam desactivado.';
    await sock.sendMessage(jid, { text });
  }
};

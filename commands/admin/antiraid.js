const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'antiraid',
  category: 'admin',
  description: 'Activar/desactivar antiraid (cierra el grupo si entran muchos usuarios de golpe)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.antiraid = !grupo.antiraid;
    guardarDB(db);

    const texto = grupo.antiraid
      ? 'Antiraid activado. Si entran mas de 5 personas en 30 segundos, el grupo se cierra automaticamente.'
      : 'Antiraid desactivado.';
    await sock.sendMessage(jid, { text });
  }
};

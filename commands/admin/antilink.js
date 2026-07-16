const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'antilink',
  category: 'admin',
  description: 'Activar/desactivar antilink',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: advertencia('Solo un admin puede usar este comando.', { titulo: 'SIN PERMISOS' }) });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.antilink = !grupo.antilink;
    guardarDB(db);

    const texto = grupo.antilink
      ? exito('Antilink activado. Se borraran los enlaces.', { titulo: 'ANTILINK' })
      : advertencia('Antilink desactivado.', { titulo: 'ANTILINK' });

    await sock.sendMessage(jid, { text: texto });
  }
};

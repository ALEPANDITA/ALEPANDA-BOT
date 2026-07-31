const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'nivelestoggle',
  aliases: ['tniveles', 'togglenivel'],
  category: 'admin',
  description: 'Activa o desactiva el sistema de niveles/xp en este grupo',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, {
        text: advertencia('Solo un admin puede activar o desactivar los niveles.', { titulo: 'SIN PERMISOS' })
      });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.nivelesActivo = !grupo.nivelesActivo;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(
        `El sistema de niveles/xp ahora esta *${grupo.nivelesActivo ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}* en este grupo.`,
        { titulo: 'NIVELES' }
      )
    });
  }
};

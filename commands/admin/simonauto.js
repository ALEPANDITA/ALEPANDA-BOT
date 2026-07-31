const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');
const { limpiarBuffer } = require('../../lib/simonWatcher');

module.exports = {
  name: 'simonauto',
  category: 'admin',
  description: 'Activa o desactiva que Simon aparezca solo (sin llamarlo) en ESTE grupo. Los comandos .simi/.panda/.simon/.cupido siguen funcionando igual.',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: advertencia('Solo un admin puede usar este comando.', { titulo: 'SIN PERMISOS' }) });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.simonAutomatico = !grupo.simonAutomatico;
    guardarDB(db);

    if (!grupo.simonAutomatico) limpiarBuffer(jid); // ya no hace falta seguir juntando contexto de este grupo

    const texto = grupo.simonAutomatico
      ? exito('Simon puede volver a aparecer solo en este grupo si detecta una pelea fuerte.', { titulo: 'SIMON AUTOMATICO' })
      : advertencia('Simon ya NO va a aparecer solo en este grupo. Los comandos .simi, .panda, .simon y .cupido siguen funcionando normal.', { titulo: 'SIMON AUTOMATICO' });

    await sock.sendMessage(jid, { text: texto });
  }
};

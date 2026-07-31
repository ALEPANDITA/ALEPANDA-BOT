const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'antiflood',
  category: 'admin',
  description: 'Activar/desactivar antiflood (limite de mensajes seguidos)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.antiflood = !grupo.antiflood;
    guardarDB(db);

    const texto = grupo.antiflood
      ? 'Antiflood activado. Si alguien manda muchos mensajes seguidos, se le mutea temporalmente.'
      : 'Antiflood desactivado.';
    await sock.sendMessage(jid, { text });
  }
};

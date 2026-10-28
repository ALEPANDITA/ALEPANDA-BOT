const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo, esOwnerBot } = require('../../lib/permisos');
const { leerConfig } = require('../../lib/config');

module.exports = {
  name: 'unmuteall',
  aliases: ['desmutear-todos', 'unmute-all'],
  category: 'admin',
  description: 'Quita el mute a TODOS los usuarios muteados de este grupo (es la unica forma de desmutear).',
  groupOnly: true,
  permiteMuteado: true, // un admin/owner muteado todavia puede usarlo
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esOwner = await esOwnerBot(sock, leerConfig(), msg);

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const contador = Object.keys(grupo.muteados || {}).length;
    grupo.muteados = {};
    guardarDB(db);

    if (contador === 0) {
      return sock.sendMessage(jid, { text: 'No habia nadie muteado en este grupo.' });
    }

    await sock.sendMessage(jid, {
      text: `✅ Se quito el mute a ${contador} usuario(s) de este grupo.`
    });
  }
};

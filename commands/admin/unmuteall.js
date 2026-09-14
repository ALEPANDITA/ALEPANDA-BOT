const { leerDB, guardarDB } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'unmuteall',
  aliases: ['desmutear-todos', 'unmute-all'],
  category: 'admin',
  description: 'Quita el mute a TODOS los usuarios muteados (util cuando .unmute individual no encuentra al usuario correcto por problemas de JID).',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const db = leerDB();
    let contador = 0;

    for (const id of Object.keys(db.usuarios || {})) {
      if (db.usuarios[id].muteado) {
        db.usuarios[id].muteado = false;
        contador++;
      }
    }

    guardarDB(db);

    if (contador === 0) {
      return sock.sendMessage(jid, { text: 'No habia nadie muteado en la base de datos.' });
    }

    await sock.sendMessage(jid, {
      text: `✅ Se quito el mute a ${contador} usuario(s) (de cualquier grupo, no solo este).`
    });
  }
};

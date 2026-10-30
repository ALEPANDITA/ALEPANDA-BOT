const { leerDB, guardarDB } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { leerConfig } = require('../../lib/config');

module.exports = {
  name: 'unmuteall',
  aliases: ['desmutear-todos', 'unmute-all'],
  category: 'admin',
  description: 'Quita el mute a TODOS los usuarios muteados, en todos los grupos Solo owner.',
  groupOnly: true,
  permiteMuteado: true, // un owner muteado todavia puede usarlo
  execute: async (sock, jid, msg) => {
    if (!(await esOwnerBot(sock, leerConfig(), msg))) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    // El mute es por grupo, pero .unmuteall es global: limpia TODOS los grupos
    const db = leerDB();
    let contador = 0;
    for (const g of Object.values(db.grupos || {})) {
      const n = Object.keys(g.muteados || {}).length;
      if (n > 0) {
        contador += n;
        g.muteados = {};
      }
    }
    guardarDB(db);

    if (contador === 0) {
      return sock.sendMessage(jid, { text: 'No habia nadie muteado en ningun grupo.' });
    }

    await sock.sendMessage(jid, {
      text: `✅ Se quito el mute a ${contador} usuario(s) (en todos los grupos).`
    });
  }
};

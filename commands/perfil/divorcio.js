const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'divorcio',
  aliases: ['divorciar', 'separar'],
  category: 'perfil',
  description: 'Termina tu matrimonio actual.',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    if (!perfil.pareja) {
      return sock.sendMessage(jid, { text: 'No estas casado/a con nadie ahorita.' }, { quoted: msg });
    }

    const parejaId = perfil.pareja;
    const perfilPareja = getUsuario(db, parejaId);

    perfil.pareja = null;
    perfilPareja.pareja = null;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `💔 @${remitente.split('@')[0]} se divorcio de @${parejaId.split('@')[0]}.`,
      mentions: [remitente, parejaId]
    }, { quoted: msg });
  }
};

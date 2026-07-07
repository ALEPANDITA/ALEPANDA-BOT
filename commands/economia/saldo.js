const { leerDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'saldo',
  category: 'economia',
  description: 'Ver tu saldo actual',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    await sock.sendMessage(jid, {
      text: `💰 En mano: *$${usuario.saldo}*\n🏦 En banco: *$${usuario.banco}*`
    });
  }
};

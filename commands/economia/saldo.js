const { leerDB, getUsuario } = require('../../lib/db');
const { caja } = require('../../lib/estilo');

module.exports = {
  name: 'saldo',
  category: 'economia',
  description: 'Ver tu saldo actual',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const texto = caja([
      `💰 En mano: *$${usuario.saldo}*`,
      `🏦 En banco: *$${usuario.banco}*`
    ], { titulo: 'TU SALDO' });

    await sock.sendMessage(jid, { text: texto });
  }
};

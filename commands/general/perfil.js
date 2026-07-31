const { leerDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'perfil',
  category: 'general',
  description: 'Muestra tu perfil o el de alguien mencionado',
  execute: async (sock, jid, msg, { texto }) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;

    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    const texto2 = `👤 *PERFIL*\n\n` +
      `Usuario: @${objetivo.split('@')[0]}\n` +
      `💰 Saldo: ${usuario.saldo || 0}\n` +
      `🏦 Banco: $${usuario.banco || 0}\n` +
      `⚠️ Warns: ${usuario.warns || 0}`;

    await sock.sendMessage(jid, { text: texto2, mentions: [objetivo] });
  }
};

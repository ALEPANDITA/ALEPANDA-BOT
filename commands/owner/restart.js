const { leerConfig } = require('../../lib/config');

module.exports = {
  name: 'restart',
  category: 'owner',
  description: 'Reinicia el bot (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.owners || !config.owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    await sock.sendMessage(jid, { text: '✎ Reiniciando el bot...\n> Espera un momento...' });
    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
};

const { leerDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'banco',
  category: 'casino',
  description: 'Muestra tu saldo en cartera y banco',
  execute: async (sock, jid, msg, { prefix }) => {
    const who = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, who);

    const cartera = usuario.saldo || 0;
    const banco = usuario.banco || 0;
    const total = cartera + banco;

    await sock.sendMessage(jid, {
      text: [
        '🐼 ALEPANDA BOT 🐼',
        '',
        '💰 *Tu fortuna en diamantes*',
        '',
        `👛 Cartera: *${cartera} 💎*`,
        `🏦 Banco: *${banco} 💎*`,
        `💎 Total: *${total} 💎*`,
        '',
        `> ${prefix}depositar <cantidad> | ${prefix}depositar all`,
        `> ${prefix}retirar <cantidad> | ${prefix}retirar all`
      ].join('\n')
    });
  }
};

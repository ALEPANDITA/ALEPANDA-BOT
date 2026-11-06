const { SUPER_OWNER } = require('../../lib/superowner');

// Manda el contacto del creador del bot como tarjeta de contacto (vCard).
module.exports = {
  name: 'owner',
  aliases: ['creador', 'dev'],
  category: 'general',
  description: 'Muestra el contacto del creador del bot',
  execute: async (sock, jid, msg) => {
    const numero = SUPER_OWNER.split('@')[0];
    const nombre = 'ALEPANDITA';
    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `FN:${nombre}\n` +
      'ORG:ALEPANDA BOT\n' +
      `TEL;type=CELL;type=VOICE;waid=${numero}:+${numero}\n` +
      'END:VCARD';

    await sock.sendMessage(jid, { contacts: { displayName: nombre, contacts: [{ vcard }] } }, { quoted: msg });
  }
};

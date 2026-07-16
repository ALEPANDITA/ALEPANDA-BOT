const { leerConfig } = require('../../lib/config');
const { esOwnerBot, SUPER_OWNER } = require('../../lib/permisos');

module.exports = {
  name: 'owners',
  category: 'owner',
  description: 'Muestra la lista de owners del bot (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const owners = config.owners || [];
    const numeros = [...new Set([...owners.map(o => o.split('@')[0]), SUPER_OWNER.split('@')[0]])];

    let texto = `👑 *OWNERS DEL BOT*\n\n`;
    numeros.forEach((numero, i) => {
      const esDev = numero === SUPER_OWNER.split('@')[0];
      texto += `${i + 1}. wa.me/${numero}${esDev ? ' (desarrollador)' : ''}\n`;
    });
    texto += `\nTotal: ${numeros.length} owner(s)`;

    await sock.sendMessage(jid, { text: texto });
  }
};

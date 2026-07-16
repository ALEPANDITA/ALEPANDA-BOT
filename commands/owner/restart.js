const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, info } = require('../../lib/estilo');

module.exports = {
  name: 'restart',
  category: 'owner',
  description: 'Reinicia el bot (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, {
      text: info('Reiniciando el bot... Espera un momento.', { titulo: 'RESTART', estilo: 'neon' })
    });

    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
};

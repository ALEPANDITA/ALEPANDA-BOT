const { leerConfig, guardarConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'modoprivado',
  aliases: ['soloyo', 'apagar'],
  category: 'owner',
  description: 'Activa/desactiva que el bot solo responda al owner. Uso: .modoprivado on / .modoprivado off',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const partes = (texto || '').trim().split(/\s+/);
    const opcion = (partes[1] || '').toLowerCase();

    if (opcion !== 'on' && opcion !== 'off') {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}modoprivado on (solo te responde a ti)\n${prefix}modoprivado off (responde a todos)`
      });
    }

    config.soloOwner = opcion === 'on';
    guardarConfig(config);

    const respuesta = config.soloOwner
      ? '🔒 Modo privado activado. El bot ya no respondera a nadie mas que a ti.'
      : '🔓 Modo privado desactivado. El bot volvio a responder a todos.';

    await sock.sendMessage(jid, { text: respuesta });
  }
};

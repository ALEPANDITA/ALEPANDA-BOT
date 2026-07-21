const { leerConfig, guardarConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito } = require('../../lib/estilo');

module.exports = {
  name: 'emojimenu',
  category: 'owner',
  description: 'Cambia el emoji que aparece antes de cada comando en el menu (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = texto.trim().split(/\s+/);
    const nuevoEmoji = partes[1];

    if (!nuevoEmoji) {
      const actual = config.menuEmoji || '🪄';
      return sock.sendMessage(jid, {
        text: advertencia(`El emoji actual es: ${actual}\n\nUso: ${prefix}emojimenu <emoji>\nEjemplo: ${prefix}emojimenu 🔥`, { titulo: 'EMOJI DEL MENU', estilo: 'neon' })
      });
    }

    config.menuEmoji = nuevoEmoji;
    guardarConfig(config);

    await sock.sendMessage(jid, { text: exito(`El emoji del menu ahora es: ${nuevoEmoji}`, { titulo: 'GUARDADO' }) });
  }
};

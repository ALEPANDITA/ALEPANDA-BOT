const { leerConfig, guardarConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, refrescarHalloween, halloweenActivo } = require('../../lib/estilo');

module.exports = {
  name: 'halloween',
  aliases: ['modohalloween'],
  category: 'owner',
  description: 'Activa o quita el estilo Halloween del menu y de las cajas de texto. Uso: .halloween on / off (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const config = leerConfig();
    if (!(await esOwnerBot(sock, config, msg))) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) }, { quoted: msg });
    }

    const arg = texto.trim().split(/\s+/)[1]?.toLowerCase();
    const prender = ['on', 'si', 'activar', 'prender'].includes(arg);
    const apagar = ['off', 'no', 'quitar', 'apagar'].includes(arg);

    if (!prender && !apagar) {
      return sock.sendMessage(jid, {
        text: `🎃 Halloween esta *${halloweenActivo() ? 'ACTIVADO' : 'DESACTIVADO'}*.\nUso: ${prefix}halloween on  |  ${prefix}halloween off`
      }, { quoted: msg });
    }

    config.halloween = prender;
    guardarConfig(config);
    refrescarHalloween();

    await sock.sendMessage(jid, {
      text: exito(prender ? 'Halloween activado 🎃 Escribe .menu para verlo.' : 'Halloween desactivado. Vuelve el diseño de siempre.', { titulo: prender ? 'HALLOWEEN' : 'DISEÑO NORMAL', estilo: 'neon' })
    }, { quoted: msg });
  }
};

const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { generarTarjetaServer } = require('../../lib/tarjetaserver');
const os = require('os');

module.exports = {
  name: 'sv',
  aliases: ['server'],
  category: 'owner',
  description: 'Muestra el estado del servidor: RAM, disco, CPU, uptime (solo owners)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    try {
      const buffer = await generarTarjetaServer();
      await sock.sendMessage(jid, { image: buffer, caption: '🖥️ *Estado del servidor*' }, { quoted: msg });
    } catch (err) {
      console.error('Error generando la tarjeta de servidor:', err);
      const memTotal = os.totalmem(), memLibre = os.freemem();
      const texto = `🖥️ *ESTADO DEL SERVIDOR*\n\n` +
        `SO: ${os.type()} ${os.release()}\n` +
        `CPU: ${os.cpus()[0]?.model || 'Desconocido'}\n` +
        `Nucleos: ${os.cpus().length}\n` +
        `RAM: ${((memTotal - memLibre) / 1024 / 1024 / 1024).toFixed(2)} GB / ${(memTotal / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
        `Uptime servidor: ${(os.uptime() / 3600).toFixed(1)}h\n` +
        `Uptime bot: ${(process.uptime() / 3600).toFixed(1)}h\n` +
        `Node.js: ${process.version}`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    }
  }
};

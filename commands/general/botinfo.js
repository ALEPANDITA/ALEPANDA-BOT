const { leerDB } = require('../../lib/db');
const { generarTarjetaBotInfo } = require('../../lib/tarjetabotinfo');

function formatearTiempo(segundos) {
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return `${dias}d ${horas}h ${minutos}m`;
}

module.exports = {
  name: 'botinfo',
  category: 'general',
  description: 'Muestra informacion general del bot',
  execute: async (sock, jid, msg, { prefix, comandos }) => {
    const db = leerDB();
    const totalUsuarios = Object.keys(db.usuarios || {}).length;
    const totalGrupos = Object.keys(db.grupos || {}).length;
    const uptime = formatearTiempo(process.uptime());
    const memoria = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`;
    const owner = 'ALEPANDITA';
    const contacto = 'https://wa.me/527732654942';

    try {
      const buffer = await generarTarjetaBotInfo({
        prefix,
        comandos: comandos.size,
        usuarios: totalUsuarios,
        grupos: totalGrupos,
        uptime,
        memoria,
        nodeVersion: process.version,
        owner,
        contacto
      });

      await sock.sendMessage(jid, { image: buffer, caption: '🐼 *ALEPANDA BOT - INFO*' }, { quoted: msg });
    } catch (err) {
      console.error('Error generando la tarjeta de botinfo:', err);
      const texto = `🐼 *ALEPANDA BOT - INFO*\n\n` +
        `Prefijo: [ ${prefix} ]\n` +
        `Comandos cargados: ${comandos.size}\n` +
        `Usuarios registrados: ${totalUsuarios}\n` +
        `Grupos registrados: ${totalGrupos}\n` +
        `Tiempo activo: ${uptime}\n` +
        `Memoria usada: ${memoria}\n` +
        `Node.js: ${process.version}\n\n` +
        `Dueño y creador: *${owner}*\n` +
        `Contacto: ${contacto}`;

      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    }
  }
};

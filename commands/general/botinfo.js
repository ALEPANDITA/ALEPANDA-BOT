const { leerDB } = require('../../lib/db');

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
    const memoria = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const texto = `🐼 *ALEPANDA BOT - INFO*\n\n` +
      `Prefijo: [ ${prefix} ]\n` +
      `Comandos cargados: ${comandos.size}\n` +
      `Usuarios registrados: ${totalUsuarios}\n` +
      `Grupos registrados: ${totalGrupos}\n` +
      `Tiempo activo: ${uptime}\n` +
      `Memoria usada: ${memoria} MB\n` +
      `Node.js: ${process.version}\n\n` +
      `Dueño y creador: *ALEPANDITA*\n` +
      `Contacto: https://wa.me/527732654942`;

    await sock.sendMessage(jid, { text: texto });
  }
};

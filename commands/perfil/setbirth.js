const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { parsearFecha, formatearCumple } = require('../../lib/cumple');
const { exito, advertencia } = require('../../lib/estilo');

// Cumpleanos que sale en .perfil. Formato DIA/MES (el ano es opcional).
module.exports = {
  name: 'setbirth',
  aliases: ['setcumple', 'setbirthday'],
  category: 'perfil',
  description: 'Guarda tu cumpleanos en el perfil. Uso: .setbirth 25/12/2000 | .setbirth 25/12 | .setbirth 25 diciembre',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const entrada = texto.trim().split(/\s+/).slice(1).join(' ').trim();

    const uso = `Pon tu fecha como *dia/mes* (el ano es opcional).\n` +
      `Ej: ${prefix}setbirth 25/12/2000\n` +
      `Ej: ${prefix}setbirth 25/12\n` +
      `Ej: ${prefix}setbirth 25 diciembre`;

    if (!entrada) {
      return sock.sendMessage(jid, { text: advertencia(uso, { titulo: 'TU CUMPLEAÑOS' }) }, { quoted: msg });
    }

    const fecha = parsearFecha(entrada);
    if (!fecha) {
      return sock.sendMessage(jid, { text: advertencia(`No entendi esa fecha.\n\n${uso}`, { titulo: 'FECHA NO VALIDA' }) }, { quoted: msg });
    }

    const db = leerDB();
    getUsuario(db, remitente).cumple = fecha;
    guardarDB(db);
    await sock.sendMessage(jid, { text: exito(`Tu cumpleaños quedo el *${formatearCumple(fecha)}* 🎂`, { titulo: 'PERFIL' }) }, { quoted: msg });
  }
};

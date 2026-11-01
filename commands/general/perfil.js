const { leerDB, getUsuario } = require('../../lib/db');
const { formatearCumple, edadDe } = require('../../lib/cumple');

module.exports = {
  name: 'perfil',
  category: 'general',
  description: 'Muestra tu perfil o el de alguien mencionado',
  execute: async (sock, jid, msg, { texto }) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;

    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    // Datos opcionales que cada quien pone con .setdesc / .setgenre / .setbirth
    let extras = '';
    if (usuario.descripcion) extras += `📝 ${usuario.descripcion}\n`;
    if (usuario.genero) extras += `🚻 Genero: ${usuario.genero.charAt(0).toUpperCase()}${usuario.genero.slice(1)}\n`;
    if (usuario.cumple) {
      const edad = edadDe(usuario.cumple);
      extras += `🎂 Cumpleaños: ${formatearCumple(usuario.cumple)}${edad !== null ? ` (${edad} años)` : ''}\n`;
    }

    const texto2 = `👤 *PERFIL*\n\n` +
      `Usuario: @${objetivo.split('@')[0]}\n` +
      extras +
      `💰 Saldo: ${usuario.saldo || 0}\n` +
      `🏦 Banco: $${usuario.banco || 0}\n` +
      `⚠️ Warns: ${usuario.warns || 0}`;

    await sock.sendMessage(jid, { text: texto2, mentions: [objetivo] });
  }
};

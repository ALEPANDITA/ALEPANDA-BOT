const { leerDB, getUsuario } = require('../../lib/db');
const { obtenerRango, siguienteRango, xpNecesario } = require('../../lib/niveles');

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
    const requerido = xpNecesario(usuario.nivel || 1);

    const texto2 = `👤 *PERFIL*\n\n` +
      `Usuario: @${objetivo.split('@')[0]}\n` +
      `Rango: ${obtenerRango(usuario.nivel || 1)}\n` +
      `Nivel: ${usuario.nivel || 1}\n` +
      `XP: ${usuario.xp || 0}/${requerido}\n` +
      `Siguiente rango: ${siguienteRango(usuario.nivel || 1)}\n\n` +
      `💰 Saldo: $${usuario.saldo || 0}\n` +
      `🏦 Banco: $${usuario.banco || 0}\n` +
      `⚠️ Warns: ${usuario.warns || 0}`;

    await sock.sendMessage(jid, { text: texto2, mentions: [objetivo] });
  }
};

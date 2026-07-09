const { leerDB, getUsuario } = require('../../lib/db');
const { xpNecesario, obtenerRango, siguienteRango } = require('../../lib/niveles');

module.exports = {
  name: 'nivel',
  category: 'owner',
  description: 'Muestra tu nivel y progreso (o el de alguien si lo mencionas)',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado || msg.key.participant || msg.key.remoteJid;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    const requerido = xpNecesario(usuario.nivel);
    const rango = obtenerRango(usuario.nivel);
    const proximoRango = siguienteRango(usuario.nivel);
    const numero = objetivo.split('@')[0];

    const barraLength = 15;
    const progreso = Math.min(usuario.xp / requerido, 1);
    const llenos = Math.round(progreso * barraLength);
    const barra = '▰'.repeat(llenos) + '▱'.repeat(barraLength - llenos);

    const texto = `📊 *NIVEL DE @${numero}*\n\n` +
      `🏅 Rango: *${rango}*\n` +
      `📈 Nivel: *${usuario.nivel}*\n` +
      `✨ XP: ${usuario.xp} / ${requerido}\n` +
      `${barra}\n\n` +
      `🎯 Siguiente rango: ${proximoRango}`;

    await sock.sendMessage(jid, { text: texto, mentions: [objetivo] });
  }
};

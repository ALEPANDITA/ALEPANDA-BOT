const { leerDB, getUsuario } = require('../../lib/db');
const { calcularNivel, calcularRango, calcularInsignia, progreso, NIVEL_MAXIMO } = require('../../lib/niveles');
const { resolverIdEnGrupo } = require('../../lib/identidad');
const { caja } = require('../../lib/estilo');

function barraProgreso(actual, necesaria, largo = 15) {
  const ratio = necesaria > 0 ? Math.min(1, actual / necesaria) : 1;
  const llenos = Math.round(ratio * largo);
  return '▰'.repeat(llenos) + '▱'.repeat(largo - llenos);
}

module.exports = {
  name: 'nivel',
  category: 'niveles',
  aliases: ['level', 'rango'],
  description: 'Muestra tu nivel, rango y progreso (o el de alguien mencionado/respondido)',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivoCrudo = mencionado || citado || remitente;

    // Mismo motivo que en setnivel.js: resolvemos al ID canonico del grupo
    // para que siempre se lea el mismo registro que usa el contador de xp
    // por mensajes, sin importar si vino como @lid o numero real.
    const objetivo = await resolverIdEnGrupo(sock, jid, objetivoCrudo);

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    const nivel = calcularNivel(usuario.xp || 0);
    const rango = calcularRango(nivel);
    const insignia = calcularInsignia(nivel);
    const avance = progreso(usuario.xp || 0);

    const lineas = [
      `👤 @${objetivo.split('@')[0]}`,
      `🏅 Rango: *${rango}*${insignia ? ` — ${insignia}` : ''}`,
      `📊 Nivel: *${nivel}/${NIVEL_MAXIMO}*`
    ];

    if (avance) {
      lineas.push(`${barraProgreso(avance.actual, avance.necesaria)}`);
      lineas.push(`✨ XP: ${avance.actual}/${avance.necesaria} (faltan ${avance.faltante})`);
    } else {
      lineas.push('🌟 ¡Nivel máximo alcanzado!');
    }

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: 'NIVEL Y RANGO' }),
      mentions: [objetivo]
    });
  }
};

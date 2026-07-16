const { leerDB, getUsuario } = require('../../lib/db');

const EMOJIS_CASA = {
  Gryffindor: '🦁',
  Slytherin: '🐍',
  Hufflepuff: '🦡',
  Ravenclaw: '🦅'
};

module.exports = {
  name: 'casa',
  category: 'perfil',
  description: 'Muestra tu casa de Hogwarts (o la de alguien mas)',
  execute: async (sock, jid, msg, { prefix }) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado || remitente;

    const db = leerDB();
    const perfil = getUsuario(db, objetivo);

    if (!perfil.casaHP) {
      const esUnoMismo = objetivo === remitente;
      return sock.sendMessage(jid, {
        text: esUnoMismo
          ? `Todavia no te ha tocado el Sombrero. Usa ${prefix}sombrero para descubrir tu casa.`
          : `@${objetivo.split('@')[0]} todavia no tiene casa asignada.`,
        mentions: esUnoMismo ? [] : [objetivo]
      }, { quoted: msg });
    }

    const emoji = EMOJIS_CASA[perfil.casaHP] || '🏰';
    await sock.sendMessage(jid, {
      text: `${emoji} @${objetivo.split('@')[0]} pertenece a *${perfil.casaHP}*`,
      mentions: [objetivo]
    }, { quoted: msg });
  }
};

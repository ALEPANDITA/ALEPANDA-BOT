const { leerDB, getUsuario } = require('../../lib/db');

const EMOJIS_CASA = {
  'Garra Escarlata': '🐼🔥',
  'Colmillo Sombrio': '🐼⚔️',
  'Bambu de Acero': '🐼🎋',
  'Mirada Carmesi': '🐼👁️'
};

module.exports = {
  name: 'casa',
  category: 'perfil',
  description: 'Muestra tu clan panda (o el de alguien mas)',
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
          ? `Todavia no te ha tocado el Sello. Usa ${prefix}sombrero para descubrir tu clan.`
          : `@${objetivo.split('@')[0]} todavia no tiene clan asignado.`,
        mentions: esUnoMismo ? [] : [objetivo]
      }, { quoted: msg });
    }

    const emoji = EMOJIS_CASA[perfil.casaHP] || '🐼';
    await sock.sendMessage(jid, {
      text: `${emoji} @${objetivo.split('@')[0]} pertenece al clan *${perfil.casaHP}*`,
      mentions: [objetivo]
    }, { quoted: msg });
  }
};

const { obtenerReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'slap',
  category: 'anime',
  description: 'le da una cachetada con un gif de anime (menciona o responde a la persona)',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado;

    try {
      const reaccion = await obtenerReaccion('slap');
      const numRemitente = remitente.split('@')[0];
      const caption = objetivo
        ? `👋 @${numRemitente} le da una cachetada a @${objetivo.split('@')[0]}`
        : `👋 @${numRemitente} le da una cachetada`;

      await sock.sendMessage(jid, {
        video: { url: reaccion.url },
        gifPlayback: true,
        caption,
        mentions: [remitente, objetivo].filter(Boolean)
      }, { quoted: msg });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo obtener la imagen, intenta de nuevo.' }, { quoted: msg });
    }
  }
};

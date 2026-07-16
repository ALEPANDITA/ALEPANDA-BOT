const { obtenerReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'bite',
  category: 'anime',
  description: 'le muerde con un gif de anime (menciona o responde a la persona)',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado;

    try {
      const reaccion = await obtenerReaccion('bite');
      const numRemitente = remitente.split('@')[0];
      const caption = objetivo
        ? `😬 @${numRemitente} le muerde a @${objetivo.split('@')[0]}`
        : `😬 @${numRemitente} le muerde`;

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

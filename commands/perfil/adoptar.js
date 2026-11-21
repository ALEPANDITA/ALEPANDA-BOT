const { proponer } = require('../../lib/familia');

module.exports = {
  name: 'adoptar',
  category: 'perfil',
  description: 'Adopta a alguien como hijo/a (mencionalo o responde a su mensaje). Debe contestar "si". Sale en el perfil de los dos.',
  execute: async (sock, jid, msg, { prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, {
        text: `Menciona a la persona o responde a su mensaje.\nEj: ${prefix}adoptar @usuario`
      }, { quoted: msg });
    }
    await proponer(sock, jid, msg, remitente, objetivo);
  }
};

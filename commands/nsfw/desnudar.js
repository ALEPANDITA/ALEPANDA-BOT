const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'desnudar',
  aliases: ['undress'],
  category: 'nsfw',
  description: 'Realiza una interacción nsfw. Uso: .desnudar [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = msg.key.participant || msg.key.remoteJid;
    const target = mentionedJid.length > 0 ? mentionedJid[0] : sender;

    try {
      const apiRes = await fetch('https://api.evogb.org/nsfw/interaction?type=undress&key=evogb-WPHlBOdu');
      const data = await apiRes.json();

      if (!data || !data.status || !data.result) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener el resultado de la API.') });
      }

      const videoUrl = data.result;
      const caption = `@${sender.split('@')[0]} le quita la ropa a @${target.split('@')[0]} para exponer su cuerpo desnudo.`;

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: caption,
        gifPlayback: true,
        mentions: [sender, target]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la solicitud NSFW.') });
    }
  }
};
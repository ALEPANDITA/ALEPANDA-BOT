const { fetchEvogb } = require('../../lib/evogb');
const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'coffee',
  aliases: ['cafe'],
  category: 'anime',
  description: 'Comparte un café con alguien o tómate uno tú solo. Uso: .coffee [@usuario]',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sender = msg.key.participant || msg.key.remoteJid;

      let mensajeTexto = '';
      if (mentionedJid.length > 0) {
        mensajeTexto = `@${sender.split('@')[0]} le da un café a @${mentionedJid[0].split('@')[0]}`;
      } else {
        mensajeTexto = `@${sender.split('@')[0]} está tomando un rico café.`;
      }

      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=coffee');
      if (!res.ok) throw new Error('Error al conectar con la API');

      const data = await res.json();
      if (!data.status || !data.result) {
        throw new Error('No se pudo obtener el archivo multimedia');
      }

      const mediaUrl = data.result;
      const isVideo = mediaUrl.endsWith('.mp4') || mediaUrl.includes('.mp4');

      if (isVideo) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          caption: mensajeTexto,
          gifPlayback: true,
          mentions: [...mentionedJid, sender]
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: mensajeTexto,
          mentions: [...mentionedJid, sender]
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el comando coffee.') });
    }
  }
};
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'chupar',
  aliases: ['pechos', 'estimular', 'desvestir'],
  category: 'nsfw',
  description: 'Interacción NSFW: Estimular los pechos con la boca y lengua. Uso: .chupar [@usuario]',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const senderUser = msg.key.participant || msg.key.remoteJid;

      const videoUrl = 'https://media.evogb.win/68d9f4.mp4';
      const desc = 'Estimular los pechos con la boca y lengua.';

      let mensajeTexto = '';
      let mentions = [];

      if (mentionedJids.length > 0) {
        const targetUser = mentionedJids[0];
        mensajeTexto = `@${senderUser.split('@')[0]} le está haciendo la interacción a @${targetUser.split('@')[0]}\n_${desc}_`;
        mentions = [senderUser, targetUser];
      } else {
        mensajeTexto = `@${senderUser.split('@')[0]} realizó la acción.\n_${desc}_`;
        mentions = [senderUser];
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: mensajeTexto,
        mentions: mentions
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrió un error al procesar la interacción.') 
      });
    }
  }
};
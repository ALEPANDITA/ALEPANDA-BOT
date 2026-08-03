const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'curioso',
  aliases: ['curious'],
  category: 'anime',
  description: 'Reacción curioso de anime. Uso: .curioso o .curioso @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sender = msg.key.participant || msg.key.remoteJid;

      let caption = '';
      let mentions = [];

      if (mentionedJid.length > 0) {
        const targetUser = mentionedJid[0];
        caption = `@${sender.split('@')[0]} tiene curiosidad por @${targetUser.split('@')[0]}`;
        mentions = [sender, targetUser];
      } else {
        caption = `@${sender.split('@')[0]} tiene curiosidad.`;
        mentions = [sender];
      }

      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=curious');
      if (!res.ok) throw new Error('Error en la API');
      
      const data = await res.json();
      if (!data.status || !data.result) {
        throw new Error('No se pudo obtener la reacción');
      }

      const videoUrl = data.result;

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        gifPlayback: true,
        caption: caption,
        mentions: mentions
      }, { quoted: msg });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la reacción.') });
    }
  }
};
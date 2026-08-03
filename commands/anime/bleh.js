const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'bored',
  aliases: ['aburrido', 'aburrida'],
  category: 'anime',
  description: 'Reacción anime de aburrimiento. Uso: .bored [@usuario]',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      const senderJid = msg.key.participant || msg.key.remoteJid;
      const senderNum = senderJid.split('@')[0];

      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      
      let caption = '';
      const mentions = [senderJid];

      if (mentionedJids.length > 0 && mentionedJids[0] !== senderJid) {
        const targetJid = mentionedJids[0];
        const targetNum = targetJid.split('@')[0];
        mentions.push(targetJid);
        caption = `@${senderNum} está aburrido/a con @${targetNum} 🥱`;
      } else {
        caption = `@${senderNum} está aburrido/a 🥱`;
      }

      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=bored');
      const data = await res.json();

      if (!data || !data.status || !data.result) {
        return sock.sendMessage(jid, { 
          text: cajaError ? cajaError('No se pudo obtener la reacción en este momento.') : 'Error al obtener la reacción.' 
        });
      }

      await sock.sendMessage(jid, {
        video: { url: data.result },
        caption: caption,
        gifPlayback: true,
        mentions: mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: 'Ocurrió un error al ejecutar la interacción anime.' 
      });
    }
  }
};
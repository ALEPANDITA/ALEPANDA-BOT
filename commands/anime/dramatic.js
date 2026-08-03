const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'dramatic',
  category: 'anime',
  description: 'Muestra una animacion dramatica interactiva. Uso: .dramatic [@usuario]',
  aliases: ['dramatico'],
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sender = msg.key.participant || msg.key.remoteJid;

      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=dramatic');
      const data = await res.json();

      if (!data || !data.status || !data.result) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la animacion dramatica.') });
      }

      const videoUrl = data.result;
      let caption = '';
      let mentions = [];

      if (mentionedJid.length > 0) {
        const target = mentionedJid[0];
        caption = `@${sender.split('@')[0]} reacciona de forma dramática ante @${target.split('@')[0]}...`;
        mentions = [sender, target];
      } else {
        caption = `@${sender.split('@')[0]} se encuentra en un momento sumamente dramático...`;
        mentions = [sender];
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: caption,
        gifPlayback: true,
        mentions: mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando.') });
    }
  }
};
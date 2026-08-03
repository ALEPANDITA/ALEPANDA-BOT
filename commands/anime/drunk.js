const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'drunk',
  category: 'anime',
  description: 'Muestra una interacción de borracho/a con o sin mención. Uso: .drunk @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const sender = msg.key.participant || msg.key.remoteJid;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      
      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=drunk');
      const data = await res.json();

      if (!data || !data.status || !data.result) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la animación de la API.') });
      }

      const videoUrl = data.result;
      const senderNumber = sender.split('@')[0];
      let caption = '';
      let mentions = [];

      if (mentioned.length > 0) {
        const target = mentioned[0];
        const targetNumber = target.split('@')[0];
        caption = `@${senderNumber} está borracho/a con @${targetNumber}`;
        mentions = [sender, target];
      } else {
        caption = `@${senderNumber} está borracho/a`;
        mentions = [sender];
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: caption,
        mentions: mentions
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el comando.') });
    }
  }
};
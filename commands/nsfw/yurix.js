const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'yurix',
  aliases: ['yurireaction'],
  category: 'nsfw',
  description: 'Realiza una interacción yuri. Uso: .yurix o .yurix @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sender = msg.key.participant || msg.key.remoteJid;

      const apiUrl = 'https://api.evogb.org/nsfw/interaction?type=yuri&key=evogb-WPHlBOdu';
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Error al conectar con la API');
      }

      const data = await response.json();

      if (!data.status || !data.result) {
        throw new Error('La API no devolvió un resultado válido');
      }

      const videoUrl = data.result;
      let mensajeTexto = '';
      let mentions = [];

      if (mentionedJids.length > 0) {
        const targetUser = mentionedJids[0];
        mensajeTexto = `@${sender.split('@')[0]} está haciendo un buen tijeraso con @${targetUser.split('@')[0]}`;
        mentions = [sender, targetUser];
      } else {
        mensajeTexto = `@${sender.split('@')[0]} está haciendo un buen tijeraso`;
        mentions = [sender];
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
        text: cajaError('No se pudo procesar el comando yurix: ' + err.message) 
      });
    }
  }
};
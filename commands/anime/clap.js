const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'clap',
  aliases: ['aplaudir'],
  category: 'anime',
  description: 'Envía una animación de aplausos interactuando con otro usuario o contigo mismo. Uso: .clap [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const senderName = `@${senderJid.split('@')[0]}`;

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetName = '';
    let allMentions = [senderJid];

    if (mentionedJids.length > 0) {
      targetName = `@${mentionedJids[0].split('@')[0]}`;
      if (!allMentions.includes(mentionedJids[0])) {
        allMentions.push(mentionedJids[0]);
      }
    }

    try {
      const response = await fetch('https://api.evogb.org/sfw/interaction?type=clap&key=evogb-WPHlBOdu');
      if (!response.ok) throw new Error('Error en la API');
      
      const data = await response.json();
      if (!data.status || !data.result) {
        throw new Error('Respuesta inválida de la API');
      }

      const mediaUrl = data.result;

      let caption = '';
      if (mentionedJids.length > 0) {
        const interacciones = [
          `${senderName} le aplaude con mucho entusiasmo a ${targetName} 👏✨`,
          `${senderName} empieza a aplaudir a ${targetName} por su gran labor 🥳👏`,
          `¡Bravo! ${senderName} aplaude fuertemente a ${targetName} 👏🎉`,
          `${senderName} le dedica unos calurosos aplausos a ${targetName} 👏🙌`
        ];
        caption = interacciones[Math.floor(Math.random() * interacciones.length)];
      } else {
        const interaccionesSolo = [
          `${senderName} se aplaude a sí mismo con mucho orgullo 👏✨`,
          `${senderName} empieza a aplaudir celebrando su propio momento 🥳👏`,
          `¡Bravo! ${senderName} se aplaude fuertemente 👏🎉`,
          `${senderName} se dedica unos calurosos aplausos 👏🙌`
        ];
        caption = interaccionesSolo[Math.floor(Math.random() * interaccionesSolo.length)];
      }

      if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('mp4')) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          caption: caption,
          gifPlayback: true,
          mentions: allMentions
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: caption,
          mentions: allMentions
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo procesar el comando: ' + err.message) });
    }
  }
};
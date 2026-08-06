const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'blush',
  category: 'anime',
  description: 'Se sonroja con un gif/imagen de anime (menciona o responde a la persona)',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      // Intentar obtener de nekos.best (endpoint directo para blush)
      let imageUrl = null;
      try {
        const response = await fetch('https://nekos.best/api/v2/blush');
        const data = await response.json();
        if (data && data.results && data.results[0] && data.results[0].url) {
          imageUrl = data.results[0].url;
        }
      } catch (e) {
        // Ignorar y pasar al respaldo
      }

      // Si falla, intentar con waifu.pics como respaldo
      if (!imageUrl) {
        try {
          const response = await fetch('https://api.waifu.pics/sfw/blush');
          const data = await response.json();
          if (data && data.url) {
            imageUrl = data.url;
          }
        } catch (e) {
          // Ignorar
        }
      }

      // Si aun no hay imagen, usar una URL de respaldo estatica garantizada
      if (!imageUrl) {
        imageUrl = 'https://i.imgur.com/74xJ6s3.gif';
      }

      // Determinar si hay usuario mencionado o respondido
      let targetUser = '';
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

      if (quoted) {
        targetUser = `@${quoted.split('@')[0]}`;
      } else if (mentioned && mentioned.length > 0) {
        targetUser = `@${mentioned[0].split('@')[0]}`;
      }

      const senderNumber = msg.key.participant || msg.key.remoteJid;
      const senderName = `@${senderNumber.split('@')[0]}`;

      let textMessage = targetUser 
        ? `${senderName} se sonroja por ${targetUser} 😳` 
        : `${senderName} se sonroja 😳`;

      const mentions = [];
      if (quoted) mentions.push(quoted);
      if (mentioned && mentioned.length > 0) mentions.push(...mentioned);
      if (msg.key.participant) mentions.push(msg.key.participant);

      // Enviar como imagen (o video si fuera gif mp4, waifu.pics y nekos.best devuelven gifs o imagenes compatibles)
      if (imageUrl.endsWith('.gif') || imageUrl.includes('waifu.pics') || imageUrl.includes('nekos.best')) {
        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: textMessage,
          mentions: [...new Set(mentions)]
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: textMessage,
          mentions: [...new Set(mentions)]
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen de sonrojo, intenta de nuevo mas tarde.') });
    }
  }
};
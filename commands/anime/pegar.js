const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pegar',
  category: 'anime',
  description: 'Le pega a alguien con un gif/video de anime. Uso: .pegar @usuario o respondiendo a un mensaje',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    
    let objetivo = null;
    if (mentionedJid.length > 0) {
      objetivo = '@' + mentionedJid[0].split('@')[0];
    } else if (quotedParticipant) {
      objetivo = '@' + quotedParticipant.split('@')[0];
    }

    const sender = msg.key.participant || msg.key.remoteJid;
    const senderTag = '@' + sender.split('@')[0];

    // APIs alternativas y confiables para reacciones de anime
    const apis = [
      'https://api.waifu.pics/sfw/punch',
      'https://nekos.best/api/v2/punch',
      'https://api.otakugifs.xyz/gif?reaction=punch'
    ];

    let imageUrl = null;

    for (const apiUrl of apis) {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) continue;
        const data = await response.json();
        
        if (apiUrl.includes('waifu.pics')) {
          imageUrl = data.url;
        } else if (apiUrl.includes('nekos.best')) {
          imageUrl = data.results?.[0]?.url;
        } else if (apiUrl.includes('otakugifs.xyz')) {
          imageUrl = data.url;
        }

        if (imageUrl) break;
      } catch (e) {
        continue;
      }
    }

    if (!imageUrl) {
      return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen de reacción, intenta de nuevo más tarde.') });
    }

    try {
      let caption = objetivo 
        ? `${senderTag} le pegó a ${objetivo} 👊` 
        : `${senderTag} está repartiendo golpes 👊`;

      const mentionsList = [...mentionedJid];
      if (quotedParticipant && !mentionsList.includes(quotedParticipant)) {
        mentionsList.push(quotedParticipant);
      }
      if (sender && !mentionsList.includes(sender)) {
        mentionsList.push(sender);
      }

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: caption,
        mentions: mentionsList
      });

    } catch (err) {
      console.error('Error en comando pegar al enviar mensaje:', err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al enviar la reacción.') });
    }
  }
};
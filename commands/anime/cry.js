const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'cry',
  category: 'anime',
  description: 'Muestra un gif de anime llorando. Uso: .cry [@usuario]',
  execute: async (sock, jid, msg) => {
    try {
      let objetivo = '';
      const mentions = [];

      const sender = msg.key.participant || msg.key.remoteJid;
      if (sender && sender.endsWith('@s.whatsapp.net')) {
        mentions.push(sender);
      }

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = contextInfo?.mentionedJid;
      const quoted = contextInfo?.quotedMessage;

      if (mentioned && mentioned.length > 0) {
        objetivo = `@${mentioned[0].split('@')[0]}`;
        if (!mentions.includes(mentioned[0])) {
          mentions.push(mentioned[0]);
        }
      } else if (quoted) {
        const participant = contextInfo?.participant;
        if (participant) {
          objetivo = `@${participant.split('@')[0]}`;
          if (!mentions.includes(participant)) {
            mentions.push(participant);
          }
        }
      }

      const senderName = sender ? `@${sender.split('@')[0]}` : '@usuario';
      let mediaUrl = null;

      const apis = [
        async () => {
          const res = await fetch('https://nekos.best/api/v2/cry');
          if (!res.ok) return null;
          const data = await res.json();
          const item = data && data.results && data.results[0];
          return item && item.url ? item.url : null;
        },
        async () => {
          const res = await fetch('https://api.otakugifs.xyz/gif?reaction=cry');
          if (!res.ok) return null;
          const data = await res.json();
          return data && data.url ? data.url : null;
        }
      ];

      for (const apiCall of apis) {
        try {
          const url = await apiCall();
          if (url) {
            mediaUrl = url;
            break;
          }
        } catch (e) {
          // Continuar con la siguiente API si falla
        }
      }

      if (!mediaUrl) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener el gif, por favor intenta de nuevo.') });
      }

      const textoRespuesta = objetivo 
        ? `${senderName} está llorando por ${objetivo} 😢` 
        : `${senderName} está llorando 😢`;

      // En Baileys, para enviar un GIF correctamente que se reproduzca en WhatsApp,
      // se debe enviar como video con gifPlayback: true y mimetype: 'video/mp4'.
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error('No se pudo descargar el contenido multimedia de la URL');
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      await sock.sendMessage(jid, {
        video: buffer,
        gifPlayback: true,
        mimetype: 'video/mp4',
        caption: textoRespuesta,
        mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al ejecutar el comando cry.') });
    }
  }
};
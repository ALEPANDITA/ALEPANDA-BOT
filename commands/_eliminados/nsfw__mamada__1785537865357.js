const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'mamada',
  category: 'nsfw',
  description: 'Le hace una mamada a alguien (menciona o responde)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    try {
      const sender = msg.key.participant || msg.key.remoteJid;
      let mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                        msg.message?.extendedTextMessage?.contextInfo?.participant;

      let gifUrl = '';
      try {
        const res = await fetch('https://purrbot.site/api/img/nsfw/blowjob/gif');
        const data = await res.json();
        if (data && data.link) gifUrl = data.link;
      } catch (err) {
        console.error('Error al obtener gif de purrbot:', err);
      }

      if (!gifUrl) {
        try {
          const res = await fetch('https://nekos.life/api/v2/img/bj');
          const data = await res.json();
          if (data && data.url) gifUrl = data.url;
        } catch (err) {
          console.error('Error al obtener gif de nekos:', err);
        }
      }

      if (!gifUrl) {
        return await sock.sendMessage(jid, { text: advertencia('No se pudo obtener el GIF de la API.') }, { quoted: msg });
      }

      const response = await fetch(gifUrl);
      const buffer = await response.buffer();

      // Invertir los roles: El mencionado es quien hace la acción al que envía (o autocomprazión si no hay mención)
      let captionText = '';
      let mentionsArr = [];

      if (mentioned && mentioned !== sender) {
        captionText = `🔥 @${mentioned.split('@')[0]} le hizo una mamada a @${sender.split('@')[0]} 😈`;
        mentionsArr = [mentioned, sender];
      } else {
        captionText = `🔥 @${sender.split('@')[0]} se está haciendo una auto-mamada 😈`;
        mentionsArr = [sender];
      }

      await sock.sendMessage(jid, {
        video: buffer,
        gifPlayback: true,
        mimetype: 'video/mp4',
        caption: captionText,
        mentions: mentionsArr.map(id => ({ id, jittered: false }))
      }, { quoted: msg });

    } catch (err) {
      console.error('Error en mamada:', err);
      await sock.sendMessage(jid, { text: cajaError(`Ocurrió un error al procesar el comando: ${err.message}`) }, { quoted: msg });
    }
  }
};
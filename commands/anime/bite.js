const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'bite',
  category: 'anime',
  description: 'Muerde a alguien con un gif/imagen de anime (menciona o responde a alguien). Uso: .bite @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Determinar el objetivo (mención o mensaje citado)
    let mencionado = msg.message?.extendedTextMessage?.contextInfo?.participant || 
                     msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const sender = msg.key.participant || msg.key.remoteJid;
    const senderTag = '@' + sender.split('@')[0];
    const targetTag = mencionado ? '@' + mencionado.split('@')[0] : null;

    let caption = targetTag ? `${senderTag} le muerde a ${targetTag}` : `${senderTag} se muerde a sí mismo o anda mordiendo`;

    try {
      // Intentar primero con nekos.best
      let imageUrl = null;
      try {
        const res = await fetch('https://nekos.best/api/v2/bite');
        const data = await res.json();
        if (data && data.results && data.results[0] && data.results[0].url) {
          imageUrl = data.results[0].url;
        }
      } catch (e) {
        // Ignorar y pasar al respaldo
      }

      // Si falla nekos.best, usar waifu.pics como respaldo
      if (!imageUrl) {
        try {
          const res = await fetch('https://api.waifu.pics/sfw/bite');
          const data = await res.json();
          if (data && data.url) {
            imageUrl = data.url;
          }
        } catch (e) {
          // Ignorar
        }
      }

      // Si ambas APIs fallan, usar una URL estática de respaldo o un GIF predeterminado funcional
      if (!imageUrl) {
        imageUrl = 'https://media.tenor.com/C41Vq4sD_84AAAAC/anime-bite.gif';
      }

      // Enviar la imagen o gif con el texto correspondiente
      const ment = mencionado ? [sender, mencionado] : [sender];

      // Verificamos si es un gif animado o imagen para enviarlo correctamente
      if (imageUrl.endsWith('.gif') || imageUrl.includes('tenor.com') || imageUrl.includes('giphy.com')) {
        await sock.sendMessage(jid, {
          video: { url: imageUrl },
          gifPlayback: true,
          caption: caption,
          mentions: ment
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: caption,
          mentions: ment
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener la reacción de mordisco en este momento.') });
    }
  }
};
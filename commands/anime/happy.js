const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'happy',
  category: 'anime',
  description: 'Muestra un gif o imagen de felicidad (menciona o responde a alguien).',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Extraer objetivo si lo hay (mención o texto)
    const args = texto.trim().split(/\s+/).slice(1);
    const objetivo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0];

    try {
      let imageUrl = null;

      // Intentar con waifu.pics primero
      try {
        const res = await fetch('https://api.waifu.pics/sfw/happy');
        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            imageUrl = data.url;
          }
        }
      } catch (e) {
        // Ignorar y pasar al respaldo
      }

      // Si waifu.pics falla, intentar con nekos.best
      if (!imageUrl) {
        try {
          const res = await fetch('https://nekos.best/api/v2/happy');
          if (res.ok) {
            const data = await res.json();
            if (data && data.results && data.results[0] && data.results[0].url) {
              imageUrl = data.results[0].url;
            }
          }
        } catch (e) {
          // Ignorar y pasar al siguiente respaldo
        }
      }

      // Último respaldo usando una URL estática o endpoint alternativo seguro
      if (!imageUrl) {
        imageUrl = 'https://media.tenor.com/images/3074c5fa3569c762589254d3df2033bc/tenor.gif';
      }

      // Obtener el emisor del mensaje
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderNumber = sender.split('@')[0];

      let caption = '';
      const mentions = [];

      if (objetivo) {
        const objNumber = typeof objetivo === 'string' ? objetivo.replace('@', '').split('@')[0] : '';
        caption = `@${senderNumber} está feliz con @${objNumber} 😊`;
        if (objetivo.includes('@')) {
          mentions.push(objetivo.replace('@', '') + '@s.whatsapp.net');
        } else if (objNumber) {
          mentions.push(objNumber + '@s.whatsapp.net');
        }
        mentions.push(sender);
      } else {
        caption = `@${senderNumber} está feliz 😊`;
        mentions.push(sender);
      }

      // Enviar como imagen o video según la URL (si termina en gif, se puede enviar como video o imagen según soporte, Baileys soporta image con gif)
      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: caption,
        mentions: mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen de felicidad, intenta de nuevo más tarde.') });
    }
  }
};
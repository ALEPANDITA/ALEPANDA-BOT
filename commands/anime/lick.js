const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'lick',
  category: 'anime',
  description: 'Lame a alguien con un gif/imagen de anime. Uso: .lick @usuario (o respondiendo a un mensaje)',
  execute: async (sock, jid, msg, { prefix }) => {
    let imageUrl = null;

    // Usar nekos.best como primera opcion ya que es muy estable para endpoints de anime
    try {
      const res = await fetch('https://nekos.best/api/v2/lick');
      if (res.ok) {
        const data = await res.json();
        if (data && data.results && data.results[0] && data.results[0].url) {
          imageUrl = data.results[0].url;
        }
      }
    } catch (e) {
      // Ignorar y pasar al respaldo
    }

    // Respaldo con waifu.pics
    if (!imageUrl) {
      try {
        const res = await fetch('https://api.waifu.pics/sfw/lick');
        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            imageUrl = data.url;
          }
        }
      } catch (e) {
        // Ignorar y pasar al siguiente
      }
    }

    // Segundo respaldo con una API estatica o GIF predeterminado si las demas fallan
    if (!imageUrl) {
      imageUrl = 'https://media1.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif';
    }

    try {
      const sender = msg.key.participant || msg.key.remoteJid;
      let target = null;
      if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        target = msg.message.extendedTextMessage.contextInfo.participant;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
        target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      }

      let caption = '';
      const mentions = [];

      if (target) {
        caption = `@${sender.split('@')[0]} le lame a @${target.split('@')[0]} 😛`;
        mentions.push(sender, target);
      } else {
        caption = `@${sender.split('@')[0]} tiene ganas de lamer a alguien 😛`;
        mentions.push(sender);
      }

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: caption,
        mentions: mentions
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al enviar la reaccion.') });
    }
  }
};
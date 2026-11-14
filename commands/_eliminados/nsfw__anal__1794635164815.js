const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'anal',
  category: 'nsfw',
  description: 'Le hace un anal a alguien (menciona o responde). Uso: .anal @usuario',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    // Obtener remitente
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const sender = senderJid.split('@')[0];

    // Detectar objetivo (mención o respuesta)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
    const mentionedJid = (contextInfo.mentionedJid && contextInfo.mentionedJid[0]) ||
                         contextInfo.participant;
    const targetJid = mentionedJid && mentionedJid !== senderJid ? mentionedJid : null;
    const target = targetJid ? targetJid.split('@')[0] : null;

    // Función para obtener URL de contenido NSFW con varios respaldos
    const obtenerUrl = async () => {
      // 1️⃣ waifu.pics (NSFW anal)
      try {
        const res = await fetch('https://api.waifu.pics/nsfw/anal');
        if (res.ok) {
          const data = await res.json();
          if (data?.url) return data.url;
        }
      } catch (_) {}

      // 2️⃣ nekos.best
      try {
        const res = await fetch('https://nekos.best/api/v2/anal');
        if (res.ok) {
          const data = await res.json();
          if (data?.results?.[0]?.url) return data.results[0].url;
        }
      } catch (_) {}

      // 3️⃣ purrbot (gif)
      try {
        const res = await fetch('https://purrbot.site/api/img/nsfw/anal/gif');
        if (res.ok) {
          const data = await res.json();
          if (data?.link) return data.link;
        }
      } catch (_) {}

      // 4️⃣ alternativa final: https://api.waifu.pics/nsfw/anal (reintento)
      try {
        const res = await fetch('https://api.waifu.pics/nsfw/anal');
        if (res.ok) {
          const data = await res.json();
          if (data?.url) return data.url;
        }
      } catch (_) {}

      return null;
    };

    const mediaUrl = await obtenerUrl();
    if (!mediaUrl) {
      await sock.sendMessage(jid, {
        text: cajaError('❌ No se pudo obtener el GIF. Intenta más tarde.')
      }, { quoted: msg });
      return;
    }

    // Construir caption y menciones
    const caption = target
      ? `🍑 @${sender} le está dando por el culo a @${target} 🔥`
      : `🍑 @${sender} anda muy goloso/a 😈`;

    const mentions = [senderJid];
    if (targetJid && targetJid !== senderJid) mentions.push(targetJid);

    // Enviar como video (gifPlayback para reproducir como GIF)
    try {
      await sock.sendMessage(jid, {
        video: { url: mediaUrl },
        gifPlayback: true,
        mimetype: 'video/mp4',
        caption,
        mentions
      }, { quoted: msg });
    } catch (err) {
      console.error('Error enviando anal:', err);
      await sock.sendMessage(jid, {
        text: cajaError('❌ Ocurrió un error al enviar el contenido.')
      }, { quoted: msg });
    }
  }
};
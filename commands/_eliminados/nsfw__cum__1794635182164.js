const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'cum',
  category: 'nsfw',
  description: 'Se viene sobre alguien (menciona o responde)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Obtener remitente
    const sender = msg.key.participant || msg.key.remoteJid;
    // Obtener primer mencionado (si lo hay)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                        msg.message?.extendedTextMessage?.contextInfo?.participant ||
                        null;

    // Función para obtener URL del GIF
    const obtenerGif = async () => {
      try {
        const res1 = await fetch('https://purrbot.site/api/img/nsfw/cum/gif');
        if (res1.ok) {
          const data1 = await res1.json();
          if (data1 && data1.link) return data1.link;
        }
      } catch (_) {}
      try {
        const res2 = await fetch('https://nekos.life/api/v2/img/cum');
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2 && data2.url) return data2.url;
        }
      } catch (_) {}
      return null;
    };

    const gifUrl = await obtenerGif();
    if (!gifUrl) {
      await sock.sendMessage(jid, {
        text: advertencia(`No se pudo obtener un GIF. Usa ${prefix}cum <mención>`, { titulo: 'ERROR' })
      }, { quoted: msg });
      return;
    }

    // Construir texto y menciones
    const senderTag = `@${sender.split('@')[0]}`;
    const mentionedTag = mentionedJid ? `@${mentionedJid.split('@')[0]}` : null;
    const caption = mentionedJid && mentionedJid !== sender
      ? `💦 ${senderTag} se vino sobre ${mentionedTag} 😈`
      : `💦 ${senderTag} se vino solo 💦`;

    const mentions = [sender];
    if (mentionedJid && mentionedJid !== sender) mentions.push(mentionedJid);

    try {
      // Enviar el GIF como documento (compatible sin necesidad de ffmpeg)
      await sock.sendMessage(jid, {
        document: { url: gifUrl },
        fileName: 'cum.gif',
        mimetype: 'image/gif',
        caption,
        mentions
      }, { quoted: msg });
    } catch (err) {
      console.error('Error enviando GIF cum:', err);
      await sock.sendMessage(jid, {
        text: cajaError('Ocurrió un error al enviar el GIF: ' + err.message)
      }, { quoted: msg });
    }
  }
};
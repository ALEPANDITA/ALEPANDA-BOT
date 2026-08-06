const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'dance',
  category: 'anime',
  description: 'Esta bailando con un gif de anime (menciona o responde a la persona)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    let mencionado = msg.message?.extendedTextMessage?.contextInfo?.participant || 
                     msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    
    const sender = msg.key.participant || msg.key.remoteJid;
    const yo = sender.split('@')[0];
    const el = mencionado ? mencionado.split('@')[0] : null;

    let mediaUrl = null;

    const apis = [
      async () => {
        const res = await fetch('https://nekos.best/api/v2/dance');
        const data = await res.json();
        return data.results?.[0]?.url;
      },
      async () => {
        const res = await fetch('https://api.waifu.pics/sfw/dance');
        const data = await res.json();
        return data.url;
      },
      async () => {
        const res = await fetch('https://nekos.life/api/v2/img/dance');
        const data = await res.json();
        return data.url;
      },
      async () => {
        const res = await fetch('https://api.otakugifs.xyz/gif?reaction=dance');
        const data = await res.json();
        return data.url;
      }
    ];

    for (const api of apis) {
      try {
        mediaUrl = await api();
        if (mediaUrl) break;
      } catch (e) {
        // Continuar con la siguiente API si falla
      }
    }

    if (!mediaUrl) {
      return sock.sendMessage(jid, { text: cajaError('No se pudo obtener el gif de baile en este momento, intenta de nuevo.') });
    }

    const caption = el ? `@${yo} esta bailando a @${el}` : `@${yo} esta bailando`;
    const mentions = [sender];
    if (mencionado) mentions.push(mencionado);

    try {
      if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('otakugifs')) {
        await sock.sendMessage(jid, { 
          video: { url: mediaUrl }, 
          caption: caption, 
          gifPlayback: true,
          mentions 
        });
      } else {
        await sock.sendMessage(jid, { 
          image: { url: mediaUrl }, 
          caption: caption, 
          mentions 
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al enviar el gif de baile.') });
    }
  }
};
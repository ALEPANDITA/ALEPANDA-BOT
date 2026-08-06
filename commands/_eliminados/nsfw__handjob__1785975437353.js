const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'handjob',
  aliases: ['paja'],
  category: 'nsfw',
  description: 'Realiza una accion mencionando a un usuario o respondiendo a su mensaje. Uso: .handjob @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.buttonsResponseMessage?.contextInfo || msg.message?.templateButtonReplyMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || [];
    
    let targetUser = mentionedJid[0];
    if (!targetUser && contextInfo?.participant) {
      targetUser = contextInfo.participant;
    }

    if (!targetUser) {
      const commandName = texto.trim().split(/\s+/)[0].slice(prefix.length) || 'handjob';
      return sock.sendMessage(jid, { 
        text: advertencia(`Debes mencionar a un usuario o responder a su mensaje para usar este comando.\nUso: ${prefix}${commandName} @usuario`, { titulo: 'FALTA MENCION' }) 
      });
    }

    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      let mediaUrl = '';
      
      // Endpoints directos y seguros para evitar fallos de API caídas o inexistentes
      const endpoints = [
        'https://api.waifu.pics/nsfw/blowjob',
        'https://nekos.life/api/v2/img/nsfw'
      ];

      for (const endpoint of endpoints) {
        if (mediaUrl) break;
        try {
          const res = await fetch(endpoint);
          if (res.ok) {
            const json = await res.json();
            if (json && (json.url || json.neko)) {
              mediaUrl = json.url || json.neko;
            }
          }
        } catch (e) {
          // Continuar con el siguiente endpoint
        }
      }

      // Respaldo robusto garantizado con un GIF de anime funcional
      if (!mediaUrl) {
        mediaUrl = 'https://media1.giphy.com/media/13ZHjidRzoi7n2/giphy.gif';
      }

      const senderName = sender ? `@${sender.split('@')[0]}` : 'Alguien';
      const targetName = targetUser ? `@${targetUser.split('@')[0]}` : 'alguien';
      const caption = `${senderName} le hace una paja a ${targetName}`;
      
      const isVideo = mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') || mediaUrl.includes('.gif');

      const mentionsList = [sender, targetUser].filter(Boolean);

      if (isVideo) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          gifPlayback: true,
          caption: caption,
          mentions: mentionsList
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption: caption,
          mentions: mentionsList
        });
      }

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrio un error al procesar el comando: ' + err.message, { titulo: 'ERROR' }) 
      });
    }
  }
};
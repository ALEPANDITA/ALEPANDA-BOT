const { fetchEvogb } = require('../../lib/evogb');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'paja',
  category: 'nsfw',
  description: 'Realiza una accion de paja mencionando a un usuario. Uso: .paja @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Obtener las menciones del mensaje actual (Baileys guarda las menciones en message.message?.extendedTextMessage?.contextInfo?.mentionedJid)
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    if (mentionedJid.length === 0) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Debes mencionar a un usuario para usar este comando.\nUso: ${prefix}paja @usuario`, { titulo: 'FALTA MENCION' }) 
      });
    }

    const targetUser = mentionedJid[0];
    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      const response = await fetchEvogb('https://api.evogb.org/nsfw/interaction?type=handjob');
      if (!response.ok) {
        throw new Error('Error en la respuesta de la API');
      }

      const data = await response.json();
      if (!data.status || !data.result) {
        throw new Error('La API no devolvio un resultado valido');
      }

      const videoUrl = data.result;
      // Invertir el uso de los @ para que quien hace la paja sea el etiquetado y quien lo ejecuta sea el emisor
      const caption = `@${targetUser.split('@')[0]} le hace una paja a @${sender.split('@')[0]}`;

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: caption,
        mentions: [sender, targetUser]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrio un error al procesar el comando: ' + err.message, { titulo: 'ERROR' }) 
      });
    }
  }
};
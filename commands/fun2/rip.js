const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'rip',
  category: 'fun2',
  description: 'Genera una imagen RIP con la foto de perfil propia, de un mencionado o de un usuario aleatorio. Uso: .rip [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      let targetJid = null;

      // Detectar si hay una mención explícita
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } 
      // Si se respondió a un mensaje, usar al autor de ese mensaje
      else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
      }

      // Si no se especificó nadie, elegir a alguien random del grupo (si es un grupo) o a sí mismo
      if (!targetJid) {
        if (jid.endsWith('@g.us')) {
          try {
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants.map(p => p.id);
            if (participants.length > 0) {
              targetJid = participants[Math.floor(Math.random() * participants.length)];
            }
          } catch (e) {
            targetJid = msg.key.participant || msg.key.remoteJid;
          }
        } else {
          targetJid = msg.key.remoteJid;
        }
      }

      // Obtener la foto de perfil del objetivo (o usar una por defecto si no tiene)
      let avatarUrl;
      try {
        avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch (e) {
        avatarUrl = 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg';
      }

      const apiUrl = `https://api.delirius.online/canvas/rip?url=${encodeURIComponent(avatarUrl)}`;
      
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Error al generar la imagen RIP');
      
      const buffer = Buffer.from(await res.arrayBuffer());

      await sock.sendMessage(jid, {
        image: buffer,
        caption: '🪦 Descansa en paz...'
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo procesar el comando rip: ' + err.message) });
    }
  }
};
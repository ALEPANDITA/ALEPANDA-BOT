const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'shit',
  category: 'fun2',
  description: 'Genera un meme shitpost con tu avatar o el de alguien mencionado. Uso: .shit [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      let targetJid = null;
      let senderJid = msg.key.participant || msg.key.remoteJid;

      // Detectar si hay una mención explícita
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        // Por si se responde a un mensaje
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
      }

      let isRandom = false;

      // Si no se mencionó a nadie, elegir a alguien random del grupo (si es grupo) o al remitente
      if (!targetJid) {
        if (jid.endsWith('@g.us')) {
          try {
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants || [];
            if (participants.length > 0) {
              const randomParticipant = participants[Math.floor(Math.random() * participants.length)];
              targetJid = randomParticipant.id;
              isRandom = true;
            }
          } catch (e) {
            targetJid = senderJid;
          }
        } else {
          targetJid = jid;
        }
      }

      if (!targetJid) {
        targetJid = senderJid;
      }

      // Obtener la foto de perfil del usuario objetivo
      let avatarUrl = 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg';
      try {
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        if (ppUrl) {
          avatarUrl = ppUrl;
        }
      } catch (e) {
        // Mantener por defecto si falla
      }

      // Construir la URL del API con la imagen obtenida
      const apiUrl = `https://api.delirius.online/canvas/shit?url=${encodeURIComponent(avatarUrl)}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Error al conectar con la API de canvas.');
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Textos interactivos según el caso
      let caption = '';
      const mentionSender = `@${senderJid.split('@')[0]}`;
      const mentionTarget = `@${targetJid.split('@')[0]}`;

      if (targetJid === senderJid) {
        caption = `${mentionSender} se miró al espejo y decidió que su vida ya es un completo shitpost. 💀`;
      } else if (isRandom) {
        caption = `${mentionSender} escaneó el entorno y decidió que ${mentionTarget} necesitaba quedar retratado en este shitpost. 😂`;
      } else {
        caption = `${mentionSender} agarró a ${mentionTarget} y lo convirtió en arte shitpost. 🎨✨`;
      }

      await sock.sendMessage(jid, {
        image: buffer,
        caption: caption,
        mentions: [senderJid, targetJid]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo generar la imagen shitpost: ' + err.message) });
    }
  }
};
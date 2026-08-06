const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'rip',
  category: 'fun2',
  description: 'Genera una imagen RIP con la foto de perfil del usuario mencionado o uno al azar (ej: .rip @usuario o .rip)',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      let targetJid = null;

      // Detectar si hay una mención en el mensaje
      const quotedMessage = msg.message?.extendedTextMessage;
      const mentionedJids = quotedMessage?.contextInfo?.mentionedJid || [];

      if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
      } else {
        // Si no se menciona a nadie, obtener participantes del grupo (si es un grupo) o usar el remitente
        if (jid.endsWith('@g.us')) {
          const groupMetadata = await sock.groupMetadata(jid).catch(() => null);
          if (groupMetadata && groupMetadata.participants) {
            const participants = groupMetadata.participants.map(p => p.id);
            if (participants.length > 0) {
              targetJid = participants[Math.floor(Math.random() * participants.length)];
            }
          }
        }
        
        // Si falló o no es grupo, usar el remitente del mensaje
        if (!targetJid) {
          targetJid = msg.key.participant || msg.key.remoteJid;
        }
      }

      if (!targetJid) {
        return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}rip [@usuario]`, { titulo: 'FALTA INFORMACION' }) });
      }

      // Obtener la foto de perfil del usuario objetivo
      let avatarUrl;
      try {
        avatarUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch {
        // Imagen por defecto si no tiene foto de perfil
        avatarUrl = 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg';
      }

      // Consumir la API de Delirius
      const apiUrl = `https://api.delirius.online/canvas/rip?url=${encodeURIComponent(avatarUrl)}`;
      const response = await fetch(apiUrl);
      const json = await response.json();

      if (!json.status || !json.data) {
        throw new Error('La API no devolvió una imagen válida.');
      }

      const imageUrl = json.data;

      // Enviar la imagen resultante con una descripción de la interacción
      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `🪦 Q.E.P.D. Alguien ha pasado a mejor vida...`
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al generar la imagen RIP: ' + err.message) });
    }
  }
};
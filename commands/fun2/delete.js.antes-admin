const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'delete',
  category: 'fun2',
  description: 'Aplica el efecto delete de canvas a tu foto o la de un usuario mencionado. Uso: .delete [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      // Determinar el jid del objetivo: si hay una mención, usarla; si no, elegir al remitente o random del grupo si es grupo.
      let targetJid = null;
      
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentionedJid && mentionedJid.length > 0) {
        targetJid = mentionedJid[0];
      } else if (msg.key.participant || msg.key.remoteJid.endsWith('@g.us')) {
        // Es un grupo, obtener participantes si es posible o usar el emisor
        const groupMetadata = jid.endsWith('@g.us') ? await sock.groupMetadata(jid).catch(() => null) : null;
        if (groupMetadata && groupMetadata.participants.length > 0) {
          const participants = groupMetadata.participants.map(p => p.id);
          // Elegir uno random
          targetJid = participants[Math.floor(Math.random() * participants.length)];
        } else {
          targetJid = msg.key.participant || msg.key.remoteJid;
        }
      } else {
        targetJid = msg.key.remoteJid;
      }

      // Obtener la foto de perfil del usuario objetivo
      let pfpUrl;
      try {
        pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch {
        pfpUrl = 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg'; // Imagen por defecto si no tiene foto
      }

      const apiUrl = `https://api.delirius.online/canvas/delete?url=${encodeURIComponent(pfpUrl)}`;

      // La API devuelve directamente la imagen (buffer) segun la descripcion "No tiene json"
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Error al obtener la imagen de la API.');

      const buffer = Buffer.from(await response.arrayBuffer());

      await sock.sendMessage(jid, {
        image: buffer,
        caption: '🗑️ ¡Eliminado!'
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando delete.') });
    }
  }
};
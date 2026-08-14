const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'bofetada',
  aliases: ['slap'],
  category: 'fun2',
  description: 'Genera una imagen de bofetada. Uso: .bofetada [@usuario1] [@usuario2]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      // Extraer contexto y menciones
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo 
        || msg.message?.imageMessage?.contextInfo 
        || msg.message?.videoMessage?.contextInfo 
        || {};

      const mentioned = contextInfo.mentionedJid || [];
      const quotedParticipant = contextInfo.participant;
      const sender = msg.key.participant || msg.key.remoteJid;

      // Obtener lista de participantes si estamos en grupo
      let groupParticipants = [];
      if (jid.endsWith('@g.us')) {
        try {
          const metadata = await sock.groupMetadata(jid);
          groupParticipants = metadata.participants.map(p => p.id);
        } catch {
          groupParticipants = [sender];
        }
      } else {
        groupParticipants = [sender, jid];
      }

      // Función para seleccionar participante aleatorio
      const getRandomParticipant = (excludeJids = []) => {
        const filtered = groupParticipants.filter(id => !excludeJids.includes(id));
        const pool = filtered.length > 0 ? filtered : groupParticipants;
        return pool[Math.floor(Math.random() * pool.length)];
      };

      let target1;
      let target2;

      if (mentioned.length >= 2) {
        target1 = mentioned[0];
        target2 = mentioned[1];
      } else if (mentioned.length === 1) {
        target1 = sender;
        target2 = mentioned[0];
      } else if (quotedParticipant) {
        target1 = sender;
        target2 = quotedParticipant;
      } else {
        target1 = sender;
        target2 = getRandomParticipant([sender]);
      }

      if (!target1) target1 = sender;
      if (!target2 || target2 === target1) {
        target2 = getRandomParticipant([target1]);
      }

      // Obtener fotos de perfil o usar un fallback predeterminado
      const getProfilePic = async (targetJid) => {
        try {
          return await sock.profilePictureUrl(targetJid, 'image');
        } catch {
          return 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg';
        }
      };

      const url1 = await getProfilePic(target1);
      const url2 = await getProfilePic(target2);

      // Endpoint de Delirius
      const apiUrl = `https://api.delirius.online/canvas/bofetada?url1=${encodeURIComponent(url1)}&url2=${encodeURIComponent(url2)}`;

      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('No se pudo obtener respuesta de la API.');

      // La API devuelve un JSON con un array "urls"
      const json = await response.json();
      const imageUrl = json.urls?.[0] || json.url || json.image;

      if (!imageUrl) {
        throw new Error('La respuesta de la API no contiene una URL de imagen válida.');
      }

      // Construir la lista de menciones para WhatsApp
      const mentionsToNotify = Array.from(new Set([target1, target2].filter(Boolean)));

      const user1Clean = target1.split('@')[0];
      const user2Clean = target2.split('@')[0];

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `¡@${user1Clean} le dio una bofetada a @${user2Clean}! 💥`,
        mentions: mentionsToNotify
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al crear la bofetada: ' + err.message) });
    }
  }
};
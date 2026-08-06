const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'bofetada',
  aliases: ['slap'],
  category: 'fun2',
  description: 'Genera una imagen de bofetada. Uso: .bofetada [@usuario1] [@usuario2] (si omites alguno, se elige al azar o se usa al remitente)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const sender = msg.key.participant || msg.key.remoteJid;

      // Obtener lista de participantes del grupo si es un grupo, para poder elegir al azar
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

      // Filtrar al remitente o participantes válidos para evitar elegirse a uno mismo si hay más opciones
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
        if (quotedParticipant) {
          target1 = quotedParticipant;
          target2 = mentioned[0];
        } else {
          // Si solo menciona a uno, el primero es el remitente (o alguien al azar si se prefiere, aqui usamos el sender) y el mencionado es el segundo
          target1 = sender;
          target2 = mentioned[0];
        }
      } else if (quotedParticipant) {
        target1 = sender;
        target2 = quotedParticipant;
      } else {
        // Sin menciones ni respuestas: elige dos al azar del grupo (o al sender y alguien al azar)
        target1 = sender;
        target2 = getRandomParticipant([sender]);
      }

      // Asegurarnos de que target1 y target2 sean válidos
      if (!target1) target1 = sender;
      if (!target2 || target2 === target1) {
        target2 = getRandomParticipant([target1]);
      }

      const getProfilePic = async (targetJid) => {
        try {
          return await sock.profilePictureUrl(targetJid, 'image');
        } catch {
          return 'https://telegra.ph/file/66c5ede2293ccf9e53efa.jpg';
        }
      };

      const url1 = await getProfilePic(target1);
      const url2 = await getProfilePic(target2);

      const apiUrl = `https://api.delirius.online/canvas/bofetada?url1=${encodeURIComponent(url1)}&url2=${encodeURIComponent(url2)}`;

      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('No se pudo generar la imagen en la API.');

      const buffer = Buffer.from(await response.arrayBuffer());

      // Construir menciones para que WhatsApp marque correctamente a los usuarios en el mensaje
      const mentionsToNotify = [];
      if (target1 && target1.includes('@')) mentionsToNotify.push(target1);
      if (target2 && target2.includes('@')) mentionsToNotify.push(target2);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `¡@${target1.split('@')[0]} le dio una bofetada a @${target2.split('@')[0]}! 💥`,
        mentions: mentionsToNotify
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al crear la bofetada: ' + err.message) });
    }
  }
};
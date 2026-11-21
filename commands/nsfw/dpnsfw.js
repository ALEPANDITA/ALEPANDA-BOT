const fs = require('fs');
const path = require('path');
const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'dp',
  aliases: ['dpnsfw', 'nsfwdp'],
  category: 'nsfw',
  description: 'Obtiene una imagen de DP NSFW e interactúa con hasta 3 usuarios etiquetados. Uso: .dp [@usuario1 @usuario2 @usuario3]',
  execute: async (sock, jid, msg) => {
    try {
      const response = await fetch('https://prexzyapis.com/nsfw/dp');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Crear carpeta de respaldo local si no existe
      const dir = path.join(__dirname, '../../database/nsfw_dp');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filename = `dp_${Date.now()}.jpg`;
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, buffer);

      // Identificar al usuario que ejecuta el comando
      const senderJid = msg.key.participant || msg.key.remoteJid || jid;
      const senderTag = `@${senderJid.split('@')[0]}`;

      // Extraer menciones extras desde el mensaje (máximo 3)
      const contextMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const extraMentions = contextMentions.filter(m => m !== senderJid).slice(0, 3);

      // Armar el texto de interacción y la lista completa de JIDs a mencionar
      let caption = '';
      if (extraMentions.length > 0) {
        const extraTags = extraMentions.map(m => `@${m.split('@')[0]}`).join(', ');
        caption = `${senderTag} está compartiendo un momento DP con ${extraTags} 🔥`;
      } else {
        caption = `${senderTag} está disfrutando de una imagen DP 🔥`;
      }

      const allMentions = [senderJid, ...extraMentions];

      // Enviar la imagen descargada al chat con la interacción y menciones
      await sock.sendMessage(jid, {
        image: buffer,
        caption: caption,
        mentions: allMentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al obtener la imagen de la API: ' + err.message) });
    }
  }
};
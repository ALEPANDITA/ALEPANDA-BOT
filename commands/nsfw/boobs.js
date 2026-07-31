const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'boobs',
  category: 'nsfw',
  description: 'Envía una imagen',
  execute: async (sock, jid, msg) => {
    try {
      const mediaDir = path.join(__dirname, 'media');
      // Filtramos cualquier archivo de imagen sin importar si está en mayúsculas o minúsculas
      const files = fs.readdirSync(mediaDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

      if (files.length === 0) {
        return await sock.sendMessage(jid, { text: '❌ No hay imágenes locales disponibles.' }, { quoted: msg });
      }

      const randomFile = files[Math.floor(Math.random() * files.length)];
      const filePath = path.join(mediaDir, randomFile);
      const buffer = fs.readFileSync(filePath);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: '🍈 ¡Listo! 😈'
      }, { quoted: msg });

    } catch (error) {
      console.error('Error detallado:', error);
      await sock.sendMessage(jid, { text: `❌ ERROR EXACTO: ${error.message}` }, { quoted: msg });
    }
  }
};

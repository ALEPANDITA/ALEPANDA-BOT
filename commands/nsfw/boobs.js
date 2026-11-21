const fs = require('fs');
const path = require('path');
const { error: cajaError } = require('../../lib/estilo');

const cacheDir = path.join(__dirname, 'boobs_cache');
const MAX_CACHE = 20;

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

module.exports = {
  name: 'boobs',
  aliases: ['tetas'],
  category: 'nsfw',
  description: 'Envía una imagen NSFW (ej: .boobs)',
  execute: async (sock, jid, msg) => {
    try {
      let files = fs.readdirSync(cacheDir);
      let buffer;

      if (files.length < MAX_CACHE) {
        try {
          const response = await fetch('https://prexzyapis.com/nsfw/boobs');
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            const fileName = `boobs_${Date.now()}_${Math.random().toString(36).substring(7)}.gif`;
            fs.writeFileSync(path.join(cacheDir, fileName), buffer);
          }
        } catch (e) {
          // Si falla la API y tenemos archivos en caché, procedemos a usar la caché
        }
      }

      if (!buffer) {
        files = fs.readdirSync(cacheDir);
        if (files.length > 0) {
          const randomFile = files[Math.floor(Math.random() * files.length)];
          buffer = fs.readFileSync(path.join(cacheDir, randomFile));
        } else {
          const response = await fetch('https://prexzyapis.com/nsfw/boobs');
          if (!response.ok) {
            throw new Error('La API respondió con un estado inválido y no hay caché disponible');
          }
          buffer = Buffer.from(await response.arrayBuffer());
        }
      }

      await sock.sendMessage(jid, {
        image: buffer,
        caption: ''
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo obtener la imagen: ' + err.message) });
    }
  }
};
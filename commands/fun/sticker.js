const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  name: 'sticker',
  category: 'fun',
  description: 'Convierte una imagen (respondida) en sticker',
  execute: async (sock, jid, msg) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, { text: 'Responde a una imagen con .sticker' });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `sticker_in_${Date.now()}.jpg`);
      const outputPath = path.join(tmpDir, `sticker_out_${Date.now()}.webp`);

      fs.writeFileSync(inputPath, buffer);

      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -q:v 75 -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const webpBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { sticker: webpBuffer });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo crear el sticker.' });
    }
  }
};

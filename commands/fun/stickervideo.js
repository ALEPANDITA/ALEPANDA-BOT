const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  name: 'stickervideo',
  aliases: ['s3'],
  category: 'fun',
  description: 'Responde a un video corto o gif con .s3 para hacer un sticker animado',
  execute: async (sock, jid, msg) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    const mensajeConVideo = citado?.videoMessage
      ? { message: citado }
      : msg.message.videoMessage
        ? msg
        : null;

    if (!mensajeConVideo) {
      return sock.sendMessage(jid, { text: 'Responde a un video o gif (corto, menos de 10 seg) con .stickervideo' });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConVideo, 'buffer', {});
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `stickvid_in_${Date.now()}.mp4`);
      const outputPath = path.join(tmpDir, `stickvid_out_${Date.now()}.webp`);
      fs.writeFileSync(inputPath, buffer);

      // Limita a 6 segundos, 15fps y 512x512 para que el sticker animado no pese demasiado.
      const comando = `ffmpeg -i "${inputPath}" -t 6 -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -loop 0 -c:v libwebp -lossless 0 -q:v 60 -preset default -an -vsync 0 -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, { maxBuffer: 1024 * 1024 * 20 }, (error) => (error ? reject(error) : resolve()));
      });

      const stats = fs.statSync(outputPath);
      if (stats.size > 1024 * 1024) {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        return sock.sendMessage(jid, { text: 'El resultado quedo muy pesado (mas de 1MB). Prueba con un video mas corto.' });
      }

      const webpBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { sticker: webpBuffer });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo crear el sticker animado.' });
    }
  }
};

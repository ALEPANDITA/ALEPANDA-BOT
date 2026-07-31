const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function escaparTexto(t) {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\u2019")
    .replace(/%/g, '\\%');
}

module.exports = {
  name: 'stickertexto',
  aliases: ['s1'],
  category: 'fun',
  description: 'Responde a una imagen con .s1 arriba|abajo para poner texto tipo meme',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, { text: `Responde a una imagen con ${prefix}s1 arriba|abajo` });
    }

    const partes = texto.trim().split(/\s+/);
    const contenido = partes.slice(1).join(' ').trim();
    const [arriba, abajo] = contenido.split('|').map(t => (t || '').trim());

    if (!arriba && !abajo) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}stickertexto arriba|abajo (respondiendo a una imagen)` });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `sticktxt_in_${Date.now()}.jpg`);
      const outputPath = path.join(tmpDir, `sticktxt_out_${Date.now()}.webp`);
      fs.writeFileSync(inputPath, buffer);

      const filtros = ['scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'];

      if (arriba) {
        filtros.push(`drawtext=text='${escaparTexto(arriba.toUpperCase())}':fontcolor=white:fontsize=42:bordercolor=black:borderw=3:x=(w-text_w)/2:y=15:font=Sans-Bold`);
      }
      if (abajo) {
        filtros.push(`drawtext=text='${escaparTexto(abajo.toUpperCase())}':fontcolor=white:fontsize=42:bordercolor=black:borderw=3:x=(w-text_w)/2:y=h-th-15:font=Sans-Bold`);
      }

      const comando = `ffmpeg -i "${inputPath}" -vf "${filtros.join(',')}" -c:v libwebp -lossless 0 -q:v 75 -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, (error) => (error ? reject(error) : resolve()));
      });

      const webpBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { sticker: webpBuffer });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo crear el sticker con texto.' });
    }
  }
};

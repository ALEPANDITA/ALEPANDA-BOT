const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const { advertencia, error: cajaError } = require('../../lib/estilo');

// webp -> png con ffmpeg, todo por pipes (sin archivos temporales). Solo toma el primer cuadro.
function webpAPng(webp) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vframes', '1', '-f', 'image2', '-c:v', 'png', 'pipe:1']);
    const partes = [];
    const limite = setTimeout(() => { ff.kill('SIGKILL'); reject(new Error('ffmpeg tardo demasiado')); }, 20000);
    ff.stdout.on('data', (d) => partes.push(d));
    ff.stdin.on('error', () => { /* ffmpeg cerro la entrada antes de tiempo: el error real sale en 'close' */ });
    ff.on('error', (err) => { clearTimeout(limite); reject(err); });
    ff.on('close', (code) => {
      clearTimeout(limite);
      const salida = Buffer.concat(partes);
      if (code === 0 && salida.length) resolve(salida);
      else reject(new Error(`ffmpeg salio con codigo ${code}`));
    });
    ff.stdin.end(webp);
  });
}

module.exports = {
  name: 'toimg',
  aliases: ['toimage', 'img'],
  category: 'tools',
  description: 'Convierte un sticker en imagen (responde al sticker con .toimg)',
  execute: async (sock, jid, msg) => {
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!citado?.stickerMessage) {
      return sock.sendMessage(jid, {
        text: advertencia('Responde a un sticker con .toimg para volverlo imagen.', { titulo: 'FALTA EL STICKER' })
      }, { quoted: msg });
    }

    try {
      const webp = await downloadMediaMessage({ message: citado }, 'buffer', {});
      const png = await webpAPng(webp);
      await sock.sendMessage(jid, { image: png }, { quoted: msg });
    } catch (err) {
      console.error('[toimg]', err.message);
      const animado = citado.stickerMessage.isAnimated;
      await sock.sendMessage(jid, {
        text: cajaError(animado ? 'Ese sticker es animado y no lo pude convertir a imagen.' : 'No pude convertir el sticker a imagen.')
      }, { quoted: msg });
    }
  }
};

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DURACION_MAXIMA_SEG = 600; // 10 minutos, para no procesar videos enormes
const TAMANO_MAXIMO_BYTES = 16 * 1024 * 1024; // 16MB, limite comodo para audio en WhatsApp

module.exports = {
  name: 'toaudio',
  aliases: ['tomp3', 'video2audio', 'extraeraudio'],
  category: 'tools',
  description: 'Responde a un video con .toaudio para sacarle el audio (agrega "voz" al final para mandarlo como nota de voz)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    const mensajeConVideo = citado?.videoMessage
      ? { message: citado }
      : msg.message.videoMessage
        ? msg
        : null;

    if (!mensajeConVideo) {
      return sock.sendMessage(jid, {
        text: `Responde a un video con ${prefix}toaudio para sacarle el audio.\n\nAgrega "voz" al final (ej: ${prefix}toaudio voz) para mandarlo como nota de voz en vez de archivo de audio.`
      }, { quoted: msg });
    }

    const comoNotaDeVoz = /\bvoz\b/i.test(texto || '');

    await sock.sendMessage(jid, { text: '🎧 Sacando el audio del video...' }, { quoted: msg });

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `toaudio_in_${Date.now()}.mp4`);
    const outputPath = path.join(
      tmpDir,
      `toaudio_out_${Date.now()}.${comoNotaDeVoz ? 'ogg' : 'mp3'}`
    );

    try {
      const buffer = await downloadMediaMessage(mensajeConVideo, 'buffer', {});
      fs.writeFileSync(inputPath, buffer);

      const comando = comoNotaDeVoz
        // opus/ogg es el formato que WhatsApp usa nativamente para notas de voz
        ? `ffmpeg -i "${inputPath}" -t ${DURACION_MAXIMA_SEG} -vn -c:a libopus -b:a 64k -ar 48000 -ac 1 -y "${outputPath}"`
        // mp3 normal, se ve como archivo de audio reproducible/descargable
        : `ffmpeg -i "${inputPath}" -t ${DURACION_MAXIMA_SEG} -vn -acodec libmp3lame -b:a 128k -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, { maxBuffer: 1024 * 1024 * 20 }, (error) => (error ? reject(error) : resolve()));
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error('ffmpeg no genero ningun archivo de salida.');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('El archivo de audio resultante quedo vacio (puede que el video no tenga pista de audio).');
      }
      if (stats.size > TAMANO_MAXIMO_BYTES) {
        fs.unlinkSync(outputPath);
        return sock.sendMessage(jid, {
          text: `El audio quedo muy pesado (mas de ${(TAMANO_MAXIMO_BYTES / (1024 * 1024)).toFixed(0)}MB). Prueba con un video mas corto.`
        }, { quoted: msg });
      }

      const audioBuffer = fs.readFileSync(outputPath);

      await sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: comoNotaDeVoz ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
        ptt: comoNotaDeVoz
      }, { quoted: msg });
    } catch (err) {
      console.error('[toaudio] error:', err);
      const mensajeError = /no such file|ffmpeg: not found|command not found/i.test(err.message || '')
        ? 'El servidor no tiene ffmpeg instalado, no puedo convertir el video.'
        : 'No se pudo convertir el video a audio.';
      await sock.sendMessage(jid, { text: mensajeError }, { quoted: msg });
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }
};

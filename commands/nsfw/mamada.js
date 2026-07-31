const https = require('https');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  console.error('Error configurando DNS:', e);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (!data.trim().startsWith('{') && !data.trim().startsWith('[')) {
            return reject(new Error('Respuesta no válida de la API'));
          }
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, destPath));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

// Convertir GIF pesado a MP4 ultraligero usando FFmpeg
function convertGifToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve(outputPath);
    });
  });
}

module.exports = {
  name: 'mamada',
  category: 'nsfw',
  description: 'Le hace una mamada a alguien (menciona o responde)',
  execute: async (sock, jid, msg) => {
    const tempGif = path.join(__dirname, `temp_${Date.now()}.gif`);
    const tempMp4 = path.join(__dirname, `temp_${Date.now()}.mp4`);

    try {
      const sender = msg.key.participant || msg.key.remoteJid;
      let mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                        msg.message?.extendedTextMessage?.contextInfo?.participant;

      let gifUrl = '';
      try {
        const data = await getJson('https://purrbot.site/api/img/nsfw/blowjob/gif');
        if (data && data.link) gifUrl = data.link;
      } catch (err) {}

      if (!gifUrl) {
        try {
          const data = await getJson('https://nekos.life/api/v2/img/bj');
          if (data && data.url) gifUrl = data.url;
        } catch (err) {}
      }

      if (!gifUrl) {
        return await sock.sendMessage(jid, { text: '❌ No se pudo obtener el GIF.' }, { quoted: msg });
      }

      // 1. Descargar GIF temporal
      await downloadFile(gifUrl, tempGif);

      // 2. Convertir a MP4 compatible
      await convertGifToMp4(tempGif, tempMp4);

      // 3. Leer buffer de MP4
      const mp4Buffer = fs.readFileSync(tempMp4);

      let captionText = (mentioned && mentioned !== sender)
        ? `🔥 @${sender.split('@')[0]} le hizo una mamada a @${mentioned.split('@')[0]} 😈`
        : `🔥 @${sender.split('@')[0]} se está haciendo una auto-mamada 😈`;

      let mentionsArr = [sender];
      if (mentioned && mentioned !== sender) mentionsArr.push(mentioned);

      // 4. Enviar como MP4 reproducible con descarga habilitada
      await sock.sendMessage(jid, {
        video: mp4Buffer,
        gifPlayback: true,
        mimetype: 'video/mp4',
        caption: captionText,
        mentions: mentionsArr
      }, { quoted: msg });

    } catch (error) {
      console.error('Error en mamada:', error);
      const errorMsg = error.stack || error.message || String(error);
      await sock.sendMessage(jid, { text: `❌ Error al procesar:\n\`\`\`${errorMsg.slice(0, 300)}\`\`\`` }, { quoted: msg });
    } finally {
      // Limpiar archivos temporales
      if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif);
      if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
    }
  }
};

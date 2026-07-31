const https = require('https');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
try { dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(downloadFile(res.headers.location, dest));
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', err => fs.unlink(dest, () => reject(err)));
  });
}
function convertGifToMp4(input, output) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -y -i "${input}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${output}"`, (err) => {
      if (err) return reject(err);
      resolve(output);
    });
  });
}
module.exports = {
  name: 'pussy',
  category: 'nsfw',
  description: 'Envía un GIF de pussy',
  execute: async (sock, jid, msg) => {
    const tempGif = path.join(__dirname, `temp_pussy_${Date.now()}.gif`);
    const tempMp4 = path.join(__dirname, `temp_pussy_${Date.now()}.mp4`);
    try {
      const data = await getJson('https://api.waifu.im/search?included_tags=ass&is_nsfw=true');
      const url = data?.images?.[0]?.url;
      if (!url) return await sock.sendMessage(jid, { text: '❌ No se pudo obtener el GIF.' }, { quoted: msg });
      await downloadFile(url, tempGif);
      await convertGifToMp4(tempGif, tempMp4);
      const buffer = fs.readFileSync(tempMp4);
      await sock.sendMessage(jid, { video: buffer, gifPlayback: true, mimetype: 'video/mp4', caption: '🐱 ¡Uff, qué rico! 🔥' }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ Error al procesar el comando.' }, { quoted: msg });
    } finally {
      if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif);
      if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
    }
  }
};

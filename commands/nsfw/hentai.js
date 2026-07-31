const https = require('https');
const dns = require('dns');

try { dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch (e) {}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (!data.trim().startsWith('{') && !data.trim().startsWith('[')) return reject(new Error('Respuesta no válida'));
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getBuffer(res.headers.location));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

module.exports = {
  name: 'hentai',
  category: 'nsfw',
  description: 'Envía una imagen Hentai aleatoria',
  execute: async (sock, jid, msg) => {
    try {
      let imgUrl = '';

      // Opción 1: Nekos.moe API (imágenes estáticas de alta calidad)
      try {
        const data = await getJson('https://nekos.moe/api/v1/random/image?nsfw=true');
        if (data && data.images && data.images.length > 0) {
          imgUrl = `https://nekos.moe/image/${data.images[0].id}`;
        }
      } catch (err) {}

      // Opción 2 de respaldo si la primera falla
      if (!imgUrl) {
        try {
          const data = await getJson('https://nekos.life/api/v2/img/hentai');
          if (data && data.url) imgUrl = data.url;
        } catch (err) {}
      }

      if (!imgUrl) {
        return await sock.sendMessage(jid, { text: '❌ No se pudo obtener la imagen.' }, { quoted: msg });
      }

      const imgBuffer = await getBuffer(imgUrl);

      await sock.sendMessage(jid, {
        image: imgBuffer,
        caption: '🔥 Aquí tienes tu imagen Hentai 😈'
      }, { quoted: msg });

    } catch (error) {
      console.error('Error en hentai:', error);
      await sock.sendMessage(jid, { text: '❌ Error al procesar la imagen.' }, { quoted: msg });
    }
  }
};

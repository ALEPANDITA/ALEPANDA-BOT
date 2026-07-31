const axios = require('axios');

module.exports = {
  name: 'femboy',
  category: 'nsfw',
  aliases: ['femb'],
  description: 'Envía una imagen aleatoria de femboy',
  execute: async (sock, jid, msg) => {
    try {
      await sock.sendMessage(jid, { text: '🔍 Buscando imagen...' }, { quoted: msg });

      const response = await axios.get('https://api.evogb.org/nsfw/random/femboy', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });

      const data = response.data;
      const imageUrl = data.url || data.image || data.result || (typeof data === 'string' ? data : null);

      if (!imageUrl) {
        return sock.sendMessage(jid, { text: '❌ No se pudo obtener una imagen válida de la API.' }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: '🔥 Aquí tienes tu imagen'
      }, { quoted: msg });

    } catch (err) {
      console.error('[femboy Error]:', err.message);
      await sock.sendMessage(jid, { text: '❌ Ocurrió un error al conectar con la API.' }, { quoted: msg });
    }
  }
};
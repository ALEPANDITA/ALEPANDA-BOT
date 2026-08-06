module.exports = {
  name: 'femboy',
  category: 'nsfw',
  aliases: ['femb'],
  description: 'Envía una imagen aleatoria de femboy',
  execute: async (sock, jid, msg, ctx) => {
    try {
      await sock.sendMessage(jid, { text: '🔍 Buscando imagen...' }, { quoted: msg });

      const response = await fetch('https://api.evogb.org/nsfw/random/femboy', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.url) {
        await sock.sendMessage(jid, {
          image: { url: data.url },
          caption: '🔥 Aquí tienes tu imagen'
        }, { quoted: msg });
      } else {
        throw new Error('No se encontró la URL de la imagen en la respuesta de la API');
      }

    } catch (err) {
      console.error('[femboy Error]:', err.message);
      if (err.message.includes('HTTP error')) {
        await sock.sendMessage(jid, { text: `❌ Ocurrió un error al conectar con la API. Código de estado: ${err.message.split('! status: ')[1]}` }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: '❌ Ocurrió un error al conectar con la API.' }, { quoted: msg });
      }
    }
  }
};
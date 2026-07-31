let limpiarTexto = (t) => t ? t.trim() : '';
try {
  const apiLib = require('../../../lib/dvyerapi');
  if (apiLib.limpiarTexto) limpiarTexto = apiLib.limpiarTexto;
} catch (e) {}

module.exports = {
  name: 'r34',
  category: 'nsfw',
  description: 'Busca imágenes en Rule34 (ej: .r34 chun_li)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const rawText = texto.slice((prefix + 'r34').length);
    let query = limpiarTexto(rawText).toLowerCase().replace(/\s+/g, '_');

    if (!query) {
      return sock.sendMessage(jid, { 
        text: `Uso: ${prefix}r34 <etiqueta>\nEjemplo: ${prefix}r34 chun_li` 
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `🔥 Buscando contenido para *${query}*...` }, { quoted: msg });

    try {
      // Endpoint oficial de la API de Rule34
      const endpoint = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=50&tags=${encodeURIComponent(query)}`;

      const res = await fetch(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

      const posts = await res.json();

      if (!Array.isArray(posts) || posts.length === 0) {
        return sock.sendMessage(jid, { 
          text: `❌ No se encontraron resultados para la búsqueda: *${query}*` 
        }, { quoted: msg });
      }

      // Filtrar publicaciones que tengan URL de archivo
      const validPosts = posts.filter(p => p.file_url);

      if (validPosts.length === 0) {
        return sock.sendMessage(jid, { text: '❌ No se encontraron imágenes válidas.' }, { quoted: msg });
      }

      // Elegir una imagen aleatoria del grupo recibido
      const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];
      const imageUrl = randomPost.file_url;
      const isVideo = imageUrl.endsWith('.mp4') || imageUrl.endsWith('.webm');

      // Enviar como video si es animación o como imagen si es estática
      if (isVideo) {
        await sock.sendMessage(jid, {
          video: { url: imageUrl },
          caption: `🔥 *Rule34:* ${query}\n🎲 Resultado aleatorio de ${validPosts.length} encontrados.`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: `🔥 *Rule34:* ${query}\n🎲 Resultado aleatorio de ${validPosts.length} encontrados.`
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('[r34] Error:', err.message);
      await sock.sendMessage(jid, { 
        text: `❌ Ocurrió un error al consultar Rule34:\n\`\`\`${err.message}\`\`\`` 
      }, { quoted: msg });
    }
  }
};

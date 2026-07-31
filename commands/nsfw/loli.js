const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'xxsearch',
  category: 'nsfw',
  description: 'Busca videos NSFW en XVideos. Uso: .xxsearch <busqueda>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Extraer la búsqueda del mensaje
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();

    if (!query) {
      const msgFalta = advertencia ? advertencia(`Uso: ${prefix}xxsearch <busqueda>`, { titulo: 'FALTA BUSQUEDA' }) : `Uso: ${prefix}xxsearch <busqueda>`;
      return sock.sendMessage(jid, { text: msgFalta });
    }

    try {
      const results = await searchXVideos(query);

      if (!results || results.length === 0) {
        const errorMsg = cajaError ? cajaError(`No se encontraron resultados para: "${query}"`) : `No se encontraron resultados para: "${query}"`;
        return sock.sendMessage(jid, { text: errorMsg });
      }

      // Construir mensaje con la lista de resultados
      let caption = `🔞 *XVIDEOS - RESULTADOS* 🔞\n\n🔍 *Búsqueda:* ${query}\n\n`;
      results.slice(0, 5).forEach((vid, index) => {
        caption += `*${index + 1}.* ${vid.title}\n`;
        if (vid.duration) caption += `⏱️ *Duración:* ${vid.duration}\n`;
        caption += `🔗 ${vid.url}\n\n`;
      });

      // Intentar enviar con la portada del primer video si existe URL de miniatura
      const firstThumb = results[0]?.thumb;

      if (firstThumb && typeof firstThumb === 'string' && firstThumb.startsWith('http')) {
        try {
          await sock.sendMessage(jid, {
            image: { url: firstThumb },
            caption: caption.trim()
          });
          return;
        } catch (e) {
          // Si falla el envío con la imagen, continuará y enviará solo texto
        }
      }

      await sock.sendMessage(jid, { text: caption.trim() });

    } catch (err) {
      console.error('Error en xxsearch:', err);
      const errMsg = cajaError ? cajaError('Ocurrió un error al realizar la búsqueda.') : 'Ocurrió un error al realizar la búsqueda.';
      await sock.sendMessage(jid, { text: errMsg });
    }
  }
};

async function searchXVideos(query) {
  const encodedQuery = encodeURIComponent(query);

  // API 1: Delirius API
  try {
    const res = await fetch(`https://deliriussapi-official.vercel.app/search/xvideos?q=${encodedQuery}`);
    if (res.ok) {
      const json = await res.json();
      const list = json.data || json.results || json;
      if (Array.isArray(list) && list.length > 0) {
        return list.map(item => ({
          title: item.title || item.titulo || 'Sin título',
          url: item.url || item.link || '',
          thumb: item.image || item.thumb || item.thumbnail || '',
          duration: item.duration || item.duracion || ''
        })).filter(v => v.url);
      }
    }
  } catch (e) {}

  // API 2: BK9 API
  try {
    const res = await fetch(`https://bk9.fun/search/xvideos?q=${encodedQuery}`);
    if (res.ok) {
      const json = await res.json();
      const list = json.BK9 || json.data || json.result;
      if (Array.isArray(list) && list.length > 0) {
        return list.map(item => ({
          title: item.title || 'Sin título',
          url: item.url || item.link || '',
          thumb: item.image || item.thumb || '',
          duration: item.duration || ''
        })).filter(v => v.url);
      }
    }
  } catch (e) {}

  // API 3: Web Scraping directo a XVideos
  try {
    const res = await fetch(`https://www.xvideos.com/?k=${encodedQuery}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    if (res.ok) {
      const html = await res.text();
      const results = [];
      const regex = /href="(\/video\d+\/[^"]*)"[^>]*title="([^"]+)"/g;
      let match;

      while ((match = regex.exec(html)) !== null && results.length < 5) {
        const urlPath = match[1];
        const rawTitle = match[2];
        const fullUrl = `https://www.xvideos.com${urlPath}`;

        if (!results.some(r => r.url === fullUrl)) {
          results.push({
            title: rawTitle.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim(),
            url: fullUrl,
            thumb: '',
            duration: ''
          });
        }
      }

      if (results.length > 0) return results;
    }
  } catch (e) {}

  return [];
}
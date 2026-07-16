const { buscarYoutubeVarios, limpiarTexto } = require('../../lib/dvyerapi');
const { guardarBusqueda } = require('../../lib/busquedas');

function formatearDuracion(segundos = 0) {
  const sec = Number(segundos) || 0;
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

function formatearVistas(numero = 0) {
  const n = Number(numero) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// Intenta primero con la libreria yt-search (busqueda directa, sin depender
// de la API externa). Si falla -por ejemplo el bloqueo 302 que da YouTube
// a IPs de datacenter/VPS- cae automaticamente a la API DVYER.
async function buscarConLibreria(query, limit) {
  const ytSearch = require('yt-search');
  const { videos } = await ytSearch(query);
  return (videos || []).slice(0, limit).map(v => ({
    url: v.url,
    title: v.title,
    thumbnail: v.thumbnail,
    duration: v.seconds || 0,
    author: v.author?.name || '',
    views: v.views || 0
  }));
}

// Tercer respaldo: instancias publicas de Invidious (frontend alterno de
// YouTube con API de busqueda propia). Se prueban varias por si alguna
// esta caida; no depende de scrapear youtube.com directo ni de DVYER.
const INSTANCIAS_INVIDIOUS = [
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.flokinet.to'
];

async function buscarConInvidious(query, limit) {
  let ultimoError;

  for (const instancia of INSTANCIAS_INVIDIOUS) {
    try {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), 6000);

      const res = await fetch(
        `${instancia}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { signal: controlador.signal }
      );
      clearTimeout(temporizador);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error('Sin resultados');

      return data.slice(0, limit).map(v => ({
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        title: v.title || '',
        thumbnail: v.videoThumbnails?.[0]?.url || '',
        duration: v.lengthSeconds || 0,
        author: v.author || '',
        views: v.viewCount || 0
      }));
    } catch (err) {
      ultimoError = err;
      // sigue con la siguiente instancia
    }
  }

  throw ultimoError || new Error('Todas las instancias de Invidious fallaron.');
}

module.exports = {
  name: 'ytsearch',
  category: 'download',
  description: 'Busca videos en YouTube (ej: .ytsearch gatos graciosos)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = limpiarTexto(texto.slice((prefix + 'ytsearch ').length));

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}ytsearch <busqueda>` });
    }

    let videos = [];
    let errorApiKey = null;

    try {
      videos = await buscarConLibreria(query, 5);
    } catch (err) {
      console.warn('[ytsearch] yt-search fallo, probando API DVYER de respaldo. Detalle:', err.message);
    }

    if (!videos.length) {
      try {
        videos = await buscarYoutubeVarios(query, 5);
      } catch (err) {
        if (err.code === 'NO_API_KEY') errorApiKey = err.message;
        console.warn('[ytsearch] API DVYER tambien fallo, probando Invidious. Detalle:', err.message);
      }
    }

    if (!videos.length) {
      try {
        videos = await buscarConInvidious(query, 5);
      } catch (err) {
        console.error('[ytsearch]', err);
        return sock.sendMessage(jid, {
          text: errorApiKey || 'No se pudo buscar en YouTube ahora mismo (fallaron los 3 metodos disponibles). Intenta en un rato.'
        });
      }
    }

    if (!videos.length) {
      return sock.sendMessage(jid, { text: 'No se encontraron resultados.' });
    }

    guardarBusqueda(jid, videos);

    await sock.sendMessage(jid, { text: `🌸 Resultados para: *${query}*\nDescarga con: ${prefix}ytmp3 <numero> o ${prefix}ytmp4 <numero>` });

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const caption = `*${i + 1}. ${v.title}*\n` +
        `Canal: ${v.author || 'Desconocido'}\n` +
        `Duracion: ${formatearDuracion(v.duration)} | Vistas: ${formatearVistas(v.views)}\n\n` +
        `⬇️ ${prefix}ytmp3 ${i + 1}  |  ${prefix}ytmp4 ${i + 1}`;

      try {
        if (v.thumbnail) {
          await sock.sendMessage(jid, { image: { url: v.thumbnail }, caption });
        } else {
          await sock.sendMessage(jid, { text: caption });
        }
      } catch (err) {
        console.error('[ytsearch] error enviando resultado', i + 1, err.message);
        await sock.sendMessage(jid, { text: caption });
      }
    }
  }
};

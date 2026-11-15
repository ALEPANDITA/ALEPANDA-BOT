const { buscarYoutubeVarios, limpiarTexto } = require('../../../lib/dvyerapi');
const { guardarBusqueda } = require('../../../lib/busquedas');
const baileys = require('@whiskeysockets/baileys');
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = baileys;

// Se pide un "pool" mas grande y se muestra un subconjunto al azar.
const TAMANO_POOL = 20;
const CANTIDAD_A_MOSTRAR = 8;

function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

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

function acortar(t = '', max = 60) {
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}

function conTimeout(promesa, ms, mensajeError) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensajeError)), ms))
  ]);
}

const TIMEOUT_MEDIA_MS = 7000;

// Cache de miniaturas ya subidas a WhatsApp (se limpia sola cada 10 minutos)
const CACHE_MEDIA_TTL_MS = 10 * 60 * 1000;
const cacheMediaPreparada = new Map();

async function prepararMediaConCache(sock, url) {
  const cacheado = cacheMediaPreparada.get(url);
  if (cacheado && (Date.now() - cacheado.ts) < CACHE_MEDIA_TTL_MS) {
    return cacheado.data;
  }
  const data = await prepareWAMessageMedia({ image: { url } }, { upload: sock.waUploadToServer });
  cacheMediaPreparada.set(url, { data, ts: Date.now() });
  return data;
}

// 1) Libreria yt-search (directo a YouTube)
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

// 3) Respaldo: instancias publicas de Invidious
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
    }
  }
  throw ultimoError || new Error('Todas las instancias de Invidious fallaron.');
}

// Nodo <biz> generado con la funcion del propio fork ultra-baileys. Es lo que
// hace que WhatsApp SI entregue el carrusel (el fork no lo agrega solo porque
// en un carrusel los botones van dentro de cada tarjeta).
function nodoBiz() {
  if (typeof baileys.getBizBinaryNode !== 'function') {
    throw new Error('Este Baileys no exporta getBizBinaryNode');
  }
  return baileys.getBizBinaryNode({
    interactiveMessage: { nativeFlowMessage: { buttons: [{ name: 'quick_reply' }] } }
  });
}

async function enviarCarrusel(sock, jid, msg, query, videos, prefix) {
  const IM = proto.Message.InteractiveMessage;

  const cards = await Promise.all(videos.map(async (v, i) => {
    let img = null;
    if (v.thumbnail) {
      try {
        img = await conTimeout(
          prepararMediaConCache(sock, v.thumbnail),
          TIMEOUT_MEDIA_MS,
          `Timeout miniatura ${i + 1}`
        );
      } catch (e) {
        console.warn(`[ytsearch][carrusel] miniatura ${i + 1}:`, e.message);
      }
    }
    return {
      header: IM.Header.fromObject({
        title: acortar(v.title, 60),
        hasMediaAttachment: !!img,
        imageMessage: img?.imageMessage || null
      }),
      body: IM.Body.fromObject({
        text: `Canal: ${v.author || 'Desconocido'}\nDuracion: ${formatearDuracion(v.duration)} | Vistas: ${formatearVistas(v.views)}`
      }),
      nativeFlowMessage: IM.NativeFlowMessage.fromObject({
        buttons: [
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 MP3', id: `${prefix}ytmp3 ${i + 1}` }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 MP4', id: `${prefix}ytmp4 ${i + 1}` }) }
        ]
      })
    };
  }));

  const interactiveMessage = IM.create({
    body: IM.Body.fromObject({ text: `🌸 Resultados para: *${query}* (desliza para ver mas)` }),
    footer: IM.Footer.fromObject({ text: 'ALEPANDA BOT' }),
    header: IM.Header.fromObject({ title: 'YouTube', subtitle: query, hasMediaAttachment: false }),
    carouselMessage: IM.CarouselMessage.fromObject({ cards, messageVersion: 1 })
  });

  const contenido = proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage
      }
    }
  });

  const mensaje = generateWAMessageFromContent(jid, contenido, {
    quoted: msg,
    userJid: sock.user?.id
  });

  await sock.relayMessage(jid, mensaje.message, {
    messageId: mensaje.key.id,
    additionalNodes: [nodoBiz()]
  });
}

// Respaldo si el carrusel falla: lista en texto + menus desplegables MP3/MP4
async function enviarListaConBotones(sock, jid, msg, query, videos, prefix) {
  const listado = videos.map((v, i) =>
    `*${i + 1}. ${v.title}*\n` +
    `Canal: ${v.author || 'Desconocido'} | Duracion: ${formatearDuracion(v.duration)} | Vistas: ${formatearVistas(v.views)}\n` +
    `⬇️ ${prefix}ytmp3 ${i + 1}  |  ${prefix}ytmp4 ${i + 1}`
  ).join('\n\n');

  await sock.sendMessage(jid, { text: `🌸 Resultados para: *${query}*\n\n${listado}` }, { quoted: msg });

  const filas = (cmd, icono) => videos.map((v, i) => ({
    title: `${icono} ${i + 1}. ${acortar(v.title, 40)}`,
    description: `${v.author || 'Desconocido'} | ${formatearDuracion(v.duration)}`,
    id: `${prefix}${cmd} ${i + 1}`
  }));

  try {
    await sock.sendMessage(jid, {
      text: 'Elige un resultado para descargar 👇',
      footer: 'ALEPANDA BOT',
      title: 'YouTube',
      buttons: [
        { text: '🎵 Descargar MP3', sections: [{ title: 'Audio', rows: filas('ytmp3', '🎵') }] },
        { text: '🎬 Descargar MP4', sections: [{ title: 'Video', rows: filas('ytmp4', '🎬') }] }
      ]
    }, { quoted: msg });
  } catch (err) {
    console.warn('[ytsearch] No se pudieron mandar los botones. Detalle:', err.message);
  }
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

    await sock.sendMessage(jid, { text: `🔎 Buscando *${query}* en YouTube...` }, { quoted: msg });

    let videos = [];
    let errorApiKey = null;

    try {
      videos = await conTimeout(buscarConLibreria(query, TAMANO_POOL), 8000, 'Timeout en yt-search');
    } catch (err) {
      console.warn('[ytsearch] yt-search fallo, probando API DVYER. Detalle:', err.message);
    }

    if (!videos.length) {
      try {
        videos = await buscarYoutubeVarios(query, TAMANO_POOL);
      } catch (err) {
        if (err.code === 'NO_API_KEY') errorApiKey = err.message;
        console.warn('[ytsearch] API DVYER fallo, probando Invidious. Detalle:', err.message);
      }
    }

    if (!videos.length) {
      try {
        videos = await buscarConInvidious(query, TAMANO_POOL);
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

    videos = mezclarArray(videos).slice(0, CANTIDAD_A_MOSTRAR);
    guardarBusqueda(jid, videos);

    try {
      await enviarCarrusel(sock, jid, msg, query, videos, prefix);
      console.log('[ytsearch] Carrusel enviado.');
    } catch (err) {
      console.warn('[ytsearch] El carrusel fallo, mando la lista con botones. Detalle:', err.message);
      await enviarListaConBotones(sock, jid, msg, query, videos, prefix);
    }
  }
};

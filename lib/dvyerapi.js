const fs = require('fs');
const path = require('path');
const os = require('os');
const { getApiKey } = require('./apikeys');

const BASE_URL = 'https://dv-yer-api.online';

function requireDvyerKey() {
  const apiKey = getApiKey('dvyer');
  if (!apiKey) {
    const err = new Error('No tienes configurada tu clave de dv-yer-api.online. Usa .setapikey dvyer <tu_clave>');
    err.code = 'NO_API_KEY';
    throw err;
  }
  return apiKey;
}

function limpiarTexto(valor = '') {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

function extraerUrlYoutube(texto = '') {
  const match = String(texto || '').match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i);
  return match ? match[0].trim() : '';
}

async function llamarYtsearch(query, limit) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/ytsearch?q=${encodeURIComponent(query)}&limit=${limit}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await res.json();

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  // La respuesta puede venir como un solo objeto o una lista de resultados,
  // dependiendo de la version de la API. Cubrimos ambos casos.
  const listaResultados = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.videos) ? data.videos
    : Array.isArray(data) ? data
    : (data ? [data] : []);

  return listaResultados
    .map(video => {
      const videoUrl = video.url || video.link || video.video_url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : '');
      if (!videoUrl) return null;
      return {
        url: videoUrl,
        title: limpiarTexto(video.title || ''),
        thumbnail: limpiarTexto(video.thumbnail || video.thumb || ''),
        duration: Number(video.duration_seconds || video.duration || video.seconds || 0),
        author: limpiarTexto(video.author?.name || video.author || video.channel || ''),
        views: Number(video.views || video.view_count || 0)
      };
    })
    .filter(Boolean);
}

async function buscarYoutube(query) {
  const resultados = await llamarYtsearch(query, 1);
  return resultados[0] || null;
}

// Trae varios resultados (para .ytsearch). Usa la misma API externa que .play,
// asi no depende de scrapear YouTube directo desde el servidor (eso es lo que
// se bloquea con HTTP 302 en VPS/hosting con IP de datacenter).
async function buscarYoutubeVarios(query, limit = 5) {
  return llamarYtsearch(query, limit);
}

async function resolverEntrada(input) {
  const urlDirecta = extraerUrlYoutube(input);
  if (urlDirecta) {
    return { url: urlDirecta, title: '', thumbnail: '', duration: 0, author: '' };
  }

  const query = limpiarTexto(input);
  if (!query) return null;

  const video = await buscarYoutube(query);
  if (!video) throw new Error('No encontre resultados en YouTube.');
  return video;
}

function elegirUrlDescarga(data = {}) {
  const candidatos = [
    data?.download_url_full,
    data?.stream_url_full,
    data?.direct_url,
    data?.provider_direct_url,
    data?.download_url,
    data?.stream_url,
    data?.url
  ].filter(Boolean);
  return candidatos[0] || '';
}

async function obtenerDatosDescarga(endpoint, videoUrl) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/${endpoint}?mode=link&url=${encodeURIComponent(videoUrl)}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await res.json();

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  const remoteUrl = elegirUrlDescarga(data);
  if (!remoteUrl) throw new Error(`La API /${endpoint} no devolvio un link valido.`);

  return {
    remoteUrl,
    title: limpiarTexto(data.title || ''),
    thumbnail: limpiarTexto(data.thumbnail || data.thumb || ''),
    author: limpiarTexto(data.author || data.channel || data.uploader || ''),
    duration: Number(data.duration_seconds || data.duration || 0),
    fileName: limpiarTexto(data.filename || data.title || 'descarga')
  };
}

async function descargarArchivo(remoteUrl, extension) {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (HTTP ${res.status}).`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const rutaTemporal = path.join(os.tmpdir(), `dvyer_${Date.now()}.${extension}`);
  fs.writeFileSync(rutaTemporal, buffer);
  return rutaTemporal;
}

module.exports = {
  obtenerDatosGenerico,
  requireDvyerKey,
  resolverEntrada,
  buscarYoutube,
  buscarYoutubeVarios,
  obtenerDatosDescarga,
  descargarArchivo,
  limpiarTexto
};

async function obtenerDatosGenerico(endpoint, videoUrl) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/${endpoint}?mode=link&url=${encodeURIComponent(videoUrl)}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await res.json();

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  const remoteUrl = elegirUrlDescarga(data);
  if (!remoteUrl) throw new Error(`La API /${endpoint} no devolvio un link valido.`);

  let tipo = 'image';
  try {
    const head = await fetch(remoteUrl, { method: 'HEAD' });
    const contentType = head.headers.get('content-type') || '';
    if (contentType.includes('video') || /\.mp4($|\?)/i.test(remoteUrl)) tipo = 'video';
  } catch {
    if (/\.mp4($|\?)/i.test(remoteUrl)) tipo = 'video';
  }

  return {
    remoteUrl,
    tipo,
    titulo: limpiarTexto(data.title || data.caption || '')
  };
}

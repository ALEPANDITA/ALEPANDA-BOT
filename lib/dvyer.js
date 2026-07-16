const { getApiKey } = require('./apikeys');

const BASE_URL = 'https://dv-yer-api.online';
const DEFAULT_API_KEY = 'dvyerFsocietyBotAPikey';
const MAX_BYTES_AUDIO = 100 * 1024 * 1024;
const MAX_BYTES_VIDEO = 100 * 1024 * 1024;
const MAX_BYTES_MEGA = 200 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function obtenerApiKey() {
  return getApiKey('dvyer') || DEFAULT_API_KEY;
}

function elegirMejorUrl(data = {}) {
  const candidatos = [
    data.download_url_full,
    data.stream_url_full,
    data.direct_url,
    data.download_url,
    data.stream_url,
    data.url,
    data.provider_direct_url
  ].filter(Boolean);
  return candidatos[0] || null;
}

function construirUrl(ruta, modo, params, apikey) {
  const url = new URL(BASE_URL + ruta);
  url.searchParams.set('mode', modo);
  url.searchParams.set('apikey', apikey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  return url.toString();
}

async function pedirMetadata(ruta, params = {}) {
  const apikey = obtenerApiKey();
  const url = construirUrl(ruta, 'link', params, apikey);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  return data;
}

async function descargarBuffer(remoteUrl, maxBytes) {
  const res = await fetch(remoteUrl, { headers: { 'User-Agent': USER_AGENT } });

  if (!res.ok) {
    throw new Error(`No se pudo descargar el archivo (HTTP ${res.status})`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`El archivo pesa demasiado (${(contentLength / 1024 / 1024).toFixed(1)} MB). El limite es ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > maxBytes) {
    throw new Error(`El archivo pesa demasiado (${(buffer.length / 1024 / 1024).toFixed(1)} MB). El limite es ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
  }

  return buffer;
}

async function descargarDirecto(ruta, params, maxBytes) {
  const apikey = obtenerApiKey();
  const url = construirUrl(ruta, 'file', params, apikey);
  return descargarBuffer(url, maxBytes);
}

async function obtenerYtmp3(videoUrl) {
  const data = await pedirMetadata('/ytmp3', { url: videoUrl });
  const remoteUrl = elegirMejorUrl(data);
  if (!remoteUrl) throw new Error('La API no devolvio un link de descarga valido.');
  const buffer = await descargarBuffer(remoteUrl, MAX_BYTES_AUDIO);
  return {
    buffer,
    title: data.title || 'YouTube M4A',
    author: data.author || data.channel || data.uploader || '',
    duration: Number(data.duration_seconds || data.duration || 0),
    thumbnail: data.thumbnail || data.thumb || '',
    fileName: data.filename || 'youtube-audio.m4a'
  };
}

async function obtenerYtmp4(videoUrl, quality = '360p') {
  const data = await pedirMetadata('/ytmp4', { url: videoUrl, quality });
  const remoteUrl = elegirMejorUrl(data);
  if (!remoteUrl) throw new Error('La API no devolvio un link de descarga valido.');
  const buffer = await descargarBuffer(remoteUrl, MAX_BYTES_VIDEO);
  return {
    buffer,
    title: data.title || 'YouTube video',
    author: data.author || data.channel || data.uploader || '',
    duration: Number(data.duration_seconds || data.duration || 0),
    thumbnail: data.thumbnail || data.thumb || '',
    fileName: data.filename || 'youtube-video.mp4'
  };
}

async function obtenerSpotify(entrada) {
  const esUrl = /^https?:\/\//i.test(entrada);
  const params = esUrl ? { url: entrada, lang: 'es18' } : { q: entrada, lang: 'es18' };

  const data = await pedirMetadata('/spotify', params);
  const remoteUrl = elegirMejorUrl(data);
  if (!remoteUrl) throw new Error('La API no devolvio un link de descarga valido.');

  const buffer = await descargarBuffer(remoteUrl, MAX_BYTES_AUDIO);

  return {
    buffer,
    title: data.title || 'Spotify',
    author: data.artist || 'Desconocido',
    duration: data.duration || '',
    thumbnail: data.thumbnail || '',
    fileName: data.filename || `${data.title || 'spotify'}.mp3`
  };
}

async function obtenerMega(fileUrl) {
  const meta = await pedirMetadata('/mega', { url: fileUrl });
  const buffer = await descargarDirecto('/mega', { url: fileUrl }, MAX_BYTES_MEGA);

  return {
    buffer,
    title: meta.title || meta.filename || 'Archivo de MEGA',
    fileName: meta.filename || 'mega-file',
    fileSize: meta.filesize || null
  };
}

module.exports = { obtenerYtmp3, obtenerYtmp4, obtenerSpotify, obtenerMega };

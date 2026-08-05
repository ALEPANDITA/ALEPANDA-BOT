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

// Igual que descargarArchivo, pero sin tocar el disco: descarga directo a
// memoria (buffer) y ya. Se usa en ytmp3/ytmp4 para ahorrarse el paso de
// escribir a disco y despues volver a leer, que no aportaba nada.
async function descargarBuffer(remoteUrl) {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = {
  obtenerDatosGenerico,
  requireDvyerKey,
  resolverEntrada,
  buscarYoutube,
  buscarYoutubeVarios,
  obtenerDatosDescarga,
  descargarArchivo,
  descargarBuffer,
  limpiarTexto,
  obtenerAnimeLatest,
  obtenerAnimeEpisodios
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

// GET /anime/subespanollatam/latest -- ultimos episodios de anime sub/doblado
// en latino agregados a la plataforma. La forma exacta del JSON de respuesta
// puede variar (results / episodes / data / lista suelta), asi que se cubren
// varios nombres de campo posibles por seguridad.
// Lee la respuesta como texto primero, y solo intenta convertirla a JSON
// despues -- asi, si la API devuelve una pagina de error en HTML en vez de
// JSON (por ejemplo un 404), el error que se ve es claro y dice exactamente
// que devolvio, en vez de un "Unexpected token '<'" confuso.
async function leerJsonSeguro(res) {
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch (e) {
    const adelanto = texto.slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(`La API respondio algo que no es JSON (HTTP ${res.status}). Probablemente la ruta cambio o esta caida. Respuesta: ${adelanto || '(vacia)'}`);
  }
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

async function obtenerAnimeLatest(limit = 20) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/anime/subespanollatam/latest?limit=${limit}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await leerJsonSeguro(res);

  const lista = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.episodes) ? data.episodes
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data) ? data
    : [];

  return lista.map(ep => ({
    titulo: limpiarTexto(ep.anime_title || ep.animeTitle || ep.title || ep.anime || ''),
    episodio: ep.episode_number ?? ep.episodeNumber ?? ep.episode ?? ep.number ?? '',
    slug: ep.anime_slug || ep.animeSlug || ep.slug || '',
    imagen: limpiarTexto(ep.thumbnail || ep.image || ep.cover || ep.poster || ''),
    url: limpiarTexto(ep.url || ep.link || '')
  })).filter(ep => ep.titulo);
}

// GET /anime/subespanol/{slug} -- lista de episodios de un anime especifico
// por su slug (el mismo que sale en .animelatest, o el nombre del anime tal
// como aparece en la url, en minusculas y con guiones).
async function obtenerAnimeEpisodios(slug, episodeLimit = 50) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/anime/subespanol/${encodeURIComponent(slug)}?episode_limit=${episodeLimit}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await leerJsonSeguro(res);

  const episodiosCrudos = Array.isArray(data?.episodes) ? data.episodes
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data) ? data
    : [];

  return {
    titulo: limpiarTexto(data.title || data.anime_title || data.name || slug),
    portada: limpiarTexto(data.cover || data.image || data.thumbnail || data.poster || ''),
    episodios: episodiosCrudos.map(ep => ({
      numero: ep.episode_number ?? ep.episodeNumber ?? ep.number ?? ep.episode ?? '',
      titulo: limpiarTexto(ep.title || ''),
      url: limpiarTexto(ep.url || ep.link || '')
    }))
  };
}

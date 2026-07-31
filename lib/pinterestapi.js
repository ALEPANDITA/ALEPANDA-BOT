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

// La API puede nombrar los campos distinto segun la version; probamos varios
// nombres posibles en vez de asumir uno solo (mismo criterio que ya se usa
// en lib/dvyerapi.js para YouTube).
function elegirCampo(obj, campos) {
  for (const c of campos) {
    if (obj && obj[c]) return obj[c];
  }
  return '';
}

async function buscarPinterest(query, limit = 6) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/pinterest/search?q=${encodeURIComponent(query)}&limit=${limit}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await res.json();

  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  const lista = Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.pins) ? data.pins
    : Array.isArray(data) ? data
    : [];

  return lista
    .map(p => {
      const imagen = limpiarTexto(elegirCampo(p, ['image', 'image_url', 'thumbnail', 'img', 'imagen', 'media_url']));
      const pinUrl = limpiarTexto(elegirCampo(p, ['url', 'link', 'pin_url', 'source_url']));
      if (!imagen && !pinUrl) return null;
      return {
        image: imagen || pinUrl,
        url: pinUrl || imagen,
        title: limpiarTexto(elegirCampo(p, ['title', 'description', 'alt_text', 'grid_title']))
      };
    })
    .filter(Boolean);
}

async function obtenerPin(pinUrl) {
  const apiKey = requireDvyerKey();
  const url = `${BASE_URL}/pinterest?url=${encodeURIComponent(pinUrl)}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const data = await res.json();

  if (!res.ok || data?.ok === false || data?.success === false) {
    throw new Error(data?.detail || data?.error?.message || data?.message || `HTTP ${res.status}`);
  }

  const imagen = limpiarTexto(elegirCampo(data, ['image', 'image_url', 'download_url_full', 'download_url', 'url', 'thumbnail']));
  const video = limpiarTexto(elegirCampo(data, ['video', 'video_url', 'download_url_video']));

  if (!imagen && !video) throw new Error('La API no devolvio ninguna imagen/video para ese pin.');

  return {
    imageUrl: imagen,
    videoUrl: video,
    title: limpiarTexto(elegirCampo(data, ['title', 'description', 'grid_title']))
  };
}

// Descarga el pin (imagen o video) y lo manda al chat. Se usa tanto desde
// .pinterest (link directo) como desde .pindl (numero de una busqueda).
async function enviarPin(sock, jid, pinUrl, opciones = {}) {
  const datos = await obtenerPin(pinUrl);
  const contextoEnvio = opciones.quoted ? { quoted: opciones.quoted } : undefined;

  if (datos.videoUrl) {
    const res = await fetch(datos.videoUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    await sock.sendMessage(jid, { video: buffer, caption: datos.title || undefined }, contextoEnvio);
  } else {
    const res = await fetch(datos.imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    await sock.sendMessage(jid, { image: buffer, caption: datos.title || undefined }, contextoEnvio);
  }

  return datos;
}

module.exports = { buscarPinterest, obtenerPin, enviarPin, requireDvyerKey, limpiarTexto };

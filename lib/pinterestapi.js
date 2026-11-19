// Pinterest: busqueda y descarga.
// Todo sale de api.evogb.org (/search/pinterestv3 y /dl/pinterest) con las claves de .setapikey evogb (pueden ser varias), via lib/evogb.js.
const { fetchEvogb } = require('./evogb');

const EVOGB = 'https://api.evogb.org';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

function limpiarTexto(valor = '') {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

// La API puede nombrar los campos distinto segun la version; probamos varios
// nombres posibles en vez de asumir uno solo.
function elegirCampo(obj, campos) {
  for (const c of campos) {
    if (obj && obj[c]) return obj[c];
  }
  return '';
}

// En Evogb el titulo puede venir como texto, null o un objeto { text: '...' }
function textoDe(v) {
  if (!v) return '';
  if (typeof v === 'string') return limpiarTexto(v);
  if (typeof v === 'object') return limpiarTexto(v.text || v.format || '');
  return '';
}

// ---------- Evogb ----------
// GET a Evogb probando todas las claves guardadas; devuelve el "data" del JSON o lanza el motivo del fallo.
async function evogbData(ruta, params) {
  const res = await fetchEvogb(`${EVOGB}${ruta}?${new URLSearchParams(params).toString()}`);
  if (!res) throw new Error('Evogb no respondio');
  let json = null;
  try { json = await res.json(); } catch (_) { json = null; }
  if (!res.ok || !json || json.status === false) {
    const motivo = json && (json.message || json.error);
    throw new Error(motivo ? (typeof motivo === 'string' ? motivo : JSON.stringify(motivo)) : `HTTP ${res.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

// data.images de /search/pinterestv3 -> [{ image, url, title, full }]
//  image = miniatura para el carrusel · url = link del pin · full = imagenes en buena calidad (de mejor a peor)
// Se saltan las tarjetas de "tableros" (solo traen miniaturas sueltas) y los repetidos.
function pinsDeBusqueda(data) {
  const lista = [];
  for (const campo of ['images', 'videos']) if (Array.isArray(data?.[campo])) lista.push(...data[campo]);
  const vistos = new Set();
  const salida = [];
  for (const p of lista) {
    const im = p && p.images && typeof p.images === 'object' ? p.images : {};
    const miniatura = limpiarTexto(im['474x'] || im['736x'] || im['236x'] || im['170x'] || im.orig);
    if (!miniatura) continue;
    const full = [im.orig, im['736x'], im['474x'], im['236x']].map(limpiarTexto).filter((u, i, a) => u && a.indexOf(u) === i);
    const url = limpiarTexto(p.pinUrl || p.url) || full[0];
    if (vistos.has(url)) continue;
    vistos.add(url);
    const usuario = p.creator && p.creator.username;
    salida.push({
      image: miniatura,
      url,
      title: textoDe(p.title) || textoDe(p.description) || (usuario ? `Pin de @${usuario}` : ''),
      full
    });
  }
  return salida;
}

async function buscarEvogb(query, limit) {
  let ultimoError = null;
  // El nombre del parametro de busqueda no esta confirmado: se prueba "query", "q" y "text".
  // La API devuelve en data.query lo que entendio; si coincide con lo pedido y no hay resultados, no se insiste.
  for (const param of ['query', 'q', 'text']) {
    try {
      const data = await evogbData('/search/pinterestv3', { [param]: query });
      const pins = pinsDeBusqueda(data);
      if (pins.length) return pins.slice(0, limit);
      ultimoError = null;
      if (limpiarTexto(data && data.query).toLowerCase() === query.toLowerCase()) break;
    } catch (err) { ultimoError = err; }
  }
  if (ultimoError) throw ultimoError;
  return [];
}

async function obtenerPinEvogb(pinUrl) {
  const d = await evogbData('/dl/pinterest', { url: pinUrl });
  const dl = limpiarTexto(elegirCampo(d, ['dl', 'download', 'url']));
  if (!dl) throw new Error('Evogb no devolvio ninguna imagen/video para ese pin.');
  const esVideo = /^video/i.test(String(d.type || '')) || /\.(mp4|mov|webm)(\?|$)/i.test(dl);
  return {
    imageUrl: esVideo ? limpiarTexto(d.thumbnail) : dl,
    videoUrl: esVideo ? dl : '',
    title: limpiarTexto(d.title),
    author: limpiarTexto(d.author || d.username)
  };
}

// ---------- Lo que usan los comandos ----------
async function buscarPinterest(query, limit = 6) {
  return buscarEvogb(query, limit);
}

async function obtenerPin(pinUrl) {
  // una imagen suelta de Pinterest no necesita API
  if (/^https?:\/\/i\.pinimg\.com\//i.test(pinUrl)) return { imageUrl: pinUrl, videoUrl: '', title: '', author: '' };
  return obtenerPinEvogb(pinUrl);
}

async function descargar(url, alternas = []) {
  let ultimo = null;
  for (const u of [url, ...alternas]) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      ultimo = new Error(`HTTP ${res.status} al bajar el archivo`);
    } catch (err) { ultimo = err; }
  }
  throw ultimo || new Error('No se pudo bajar el archivo');
}

// Descarga el pin (imagen o video) y lo manda al chat. Se usa tanto desde
// .pinterest (link directo) como desde .pindl (numero de una busqueda).
//   opciones.quoted   mensaje al que se responde
//   opciones.directas imagenes ya conocidas del resultado de la busqueda (mejor calidad primero): no gasta otra llamada a la API
//   opciones.titulo   titulo del resultado de la busqueda
async function enviarPin(sock, jid, pinUrl, opciones = {}) {
  const directas = Array.isArray(opciones.directas) ? opciones.directas.filter(Boolean) : [];
  const datos = directas.length
    ? { imageUrl: directas[0], alternas: directas.slice(1), videoUrl: '', title: opciones.titulo || '', author: '' }
    : await obtenerPin(pinUrl);
  const contextoEnvio = opciones.quoted ? { quoted: opciones.quoted } : undefined;
  const pie = [datos.title, datos.author ? `👤 ${datos.author}` : ''].filter(Boolean).join('\n') || undefined;

  if (datos.videoUrl) {
    const buffer = await descargar(datos.videoUrl);
    await sock.sendMessage(jid, { video: buffer, caption: pie }, contextoEnvio);
  } else {
    const buffer = await descargar(datos.imageUrl, datos.alternas || []);
    await sock.sendMessage(jid, { image: buffer, caption: pie }, contextoEnvio);
  }

  return datos;
}

module.exports = { buscarPinterest, obtenerPin, enviarPin, limpiarTexto };

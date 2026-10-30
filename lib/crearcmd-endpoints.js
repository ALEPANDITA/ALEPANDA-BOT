// lib/crearcmd-endpoints.js
//
// Cuando el owner pega URLs de una API en .crearcmd / .arreglarcmd, el bot las
// PRUEBA en vivo (GET) y le muestra a la IA lo que de verdad responden: la forma
// del JSON, si es una lista de categorias/acciones, que campo trae el gif/archivo...
// Asi la IA no adivina: detecta si un endpoint trae varias reacciones/acciones
// (para crear un comando por cada una) y escribe el codigo leyendo el JSON real.

const MAX_URLS = 6;
const TIMEOUT_MS = 10000;
const MAX_CHARS = 300000;
const HOST_PRIVADO = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1)/i;
const PLANTILLA = /\{[^}]*\}|<[^>]*>|\$\{[^}]*\}/;

function corto(t, max) {
  const x = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return x.length > max ? x.slice(0, max - 1) + '…' : x;
}

function extraerUrls(texto) {
  const crudas = String(texto || '').match(/https?:\/\/[^\s"'`<>)\]|]+/g) || [];
  const urls = [];
  for (let u of crudas) {
    u = u.replace(/[.,;:!?)]+$/, '');
    try { new URL(u.replace(PLANTILLA, 'x')); } catch (_) { continue; }
    if (!urls.includes(u)) urls.push(u);
  }
  return urls.slice(0, MAX_URLS);
}

// Si la URL lleva una variable ({tipo}, ${x}...), se prueba la parte de arriba (suele listar las opciones)
function urlParaProbar(url) {
  const m = PLANTILLA.exec(url);
  if (!m) return { url, plantilla: false };
  const antes = url.slice(0, m.index);
  const base = antes.slice(0, antes.lastIndexOf('/') + 1) || antes;
  return { url: base, plantilla: true };
}

// ---------- resumir el JSON ----------

function resumir(v, d = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[${v.length} elementos; el primero: ${resumir(v[0], d + 1)}]`;
  }
  if (typeof v === 'object') {
    const claves = Object.keys(v);
    if (d >= 3) return `{${claves.length} claves}`;
    const partes = claves.slice(0, 10).map((k) => `${k}: ${resumir(v[k], d + 1)}`);
    return `{ ${partes.join(', ')}${claves.length > 10 ? `, … +${claves.length - 10} claves` : ''} }`;
  }
  if (typeof v === 'string') return JSON.stringify(v.length > 70 ? v.slice(0, 67) + '…' : v);
  return String(v);
}

const CAMPOS_NOMBRE = ['name', 'type', 'id', 'category', 'categoria', 'endpoint', 'slug', 'key', 'title'];
const CONTENEDORES = ['endpoints', 'categories', 'categorias', 'types', 'tipos', 'reactions', 'reacciones', 'list', 'lista', 'results', 'data', 'sfw', 'nsfw', 'items'];

// Busca si el JSON es (o contiene) una lista de varias acciones/categorias. Devuelve { donde, nombres } o null
function detectarLista(v, ruta = '(raiz)', d = 0) {
  if (v === null || typeof v !== 'object' || d > 2) return null;

  if (Array.isArray(v)) {
    if (v.length >= 3 && v.every((x) => typeof x === 'string') && v.every((x) => x.length < 40)) {
      return { donde: ruta, nombres: v.slice(0, 80) };
    }
    if (v.length >= 3 && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      const campo = CAMPOS_NOMBRE.find((c) => v.every((x) => typeof x[c] === 'string'));
      if (campo) return { donde: `${ruta} (campo "${campo}")`, nombres: v.map((x) => x[campo]).slice(0, 80) };
    }
    return null;
  }

  const claves = Object.keys(v);
  for (const c of CONTENEDORES) {
    if (claves.includes(c)) {
      const r = detectarLista(v[c], `${ruta}.${c}`, d + 1);
      if (r) return r;
    }
  }
  // Objeto cuyas claves son las acciones/categorias (ej. { hug: {...}, kiss: {...}, pat: {...} })
  if (claves.length >= 4 && claves.every((k) => /^[\w .-]{1,40}$/.test(k)) && claves.every((k) => v[k] === null || typeof v[k] === 'object' || typeof v[k] === 'string')) {
    return { donde: `${ruta} (las claves del objeto)`, nombres: claves.slice(0, 80) };
  }
  return null;
}

// ---------- probar ----------

async function probarEndpoint(urlOriginal) {
  const { url, plantilla } = urlParaProbar(urlOriginal);
  const base = { urlOriginal, urlProbada: url, plantilla };

  let host = '';
  try { host = new URL(url).hostname; } catch (_) { return { ...base, ok: false, error: 'URL invalida' }; }
  if (HOST_PRIVADO.test(host)) return { ...base, ok: false, error: 'direccion interna, no se prueba' };

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/json,text/plain,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const tipo = String(res.headers.get('content-type') || '');
    const texto = (await res.text()).slice(0, MAX_CHARS);
    const r = { ...base, ok: res.ok, status: res.status, tipo };

    if (/^\s*(<!doctype|<html)/i.test(texto)) return { ...r, formato: 'html', muestra: corto(texto.replace(/<[^>]+>/g, ' '), 200) };

    let json;
    try { json = JSON.parse(texto); } catch (_) { return { ...r, formato: 'texto', muestra: corto(texto, 300) }; }

    const lista = detectarLista(json);
    return { ...r, formato: 'json', resumen: corto(resumir(json), 1500), crudo: corto(JSON.stringify(json), 700), lista };
  } catch (err) {
    const causa = err && err.name === 'TimeoutError' ? `tardo mas de ${TIMEOUT_MS / 1000} s` : ((err && err.cause && err.cause.code) || (err && err.message) || 'error de red');
    return { ...base, ok: false, error: causa };
  }
}

async function probarEndpoints(urls) {
  return Promise.all(urls.map(probarEndpoint));
}

// ---------- textos ----------

// Para la IA (planes y codigo)
function textoParaIA(resultados) {
  if (!resultados || !resultados.length) return '';
  const bloques = resultados.map((r) => {
    const cab = `- ${r.urlOriginal}${r.plantilla ? ` (lleva una variable; el bot probo ${r.urlProbada})` : ''}`;
    if (r.error) return `${cab}\n  NO SE PUDO PROBAR: ${r.error}`;
    const estado = `HTTP ${r.status}${r.ok ? '' : ' (fallo)'}, ${r.tipo || 'sin content-type'}`;
    if (r.formato === 'html') return `${cab}\n  ${estado}. Devuelve una pagina web (HTML), NO JSON. Texto: ${r.muestra}`;
    if (r.formato === 'texto') return `${cab}\n  ${estado}. No es JSON. Texto: ${r.muestra}`;
    const lista = r.lista
      ? `\n  LISTA DETECTADA en ${r.lista.donde}: ${r.lista.nombres.length} elementos -> ${r.lista.nombres.join(', ')}`
      : '';
    return `${cab}\n  ${estado}. Forma del JSON: ${r.resumen}\n  Inicio de la respuesta: ${r.crudo}${lista}`;
  });
  return `RESPUESTAS REALES DE LOS ENDPOINTS (el bot los probo en vivo ahora mismo; escribe el codigo leyendo EXACTAMENTE esta forma, no adivines los nombres de los campos):\n${bloques.join('\n')}`;
}

// Para el owner (corto)
function textoParaOwner(resultados) {
  if (!resultados || !resultados.length) return '';
  const lineas = resultados.map((r) => {
    const u = corto(r.urlOriginal, 70);
    if (r.error) return `❌ ${u} → no pude probarlo (${r.error})`;
    if (r.formato === 'html') return `⚠️ ${u} → devuelve una pagina web (HTML), no JSON`;
    if (r.formato === 'texto') return `⚠️ ${u} → responde texto, no JSON`;
    const nota = r.plantilla ? ' (probe la parte de arriba porque lleva variable)' : '';
    if (r.lista) {
      const n = r.lista.nombres;
      return `✅ ${u}${nota} → JSON con *${n.length} opciones*: ${n.slice(0, 12).join(', ')}${n.length > 12 ? `, … +${n.length - 12}` : ''}`;
    }
    return `${r.ok ? '✅' : '⚠️'} ${u}${nota} → JSON${r.ok ? '' : ` (HTTP ${r.status})`}: ${corto(r.resumen, 110)}`;
  });
  return `🌐 *Revise los endpoints que pasaste:*\n${lineas.join('\n')}`;
}

module.exports = { extraerUrls, probarEndpoints, probarEndpoint, textoParaIA, textoParaOwner, detectarLista, resumir };

// Generador de logos con texto (efectos de ephoto360).
// Uso: const buffer = await generarLogo('Panda', 'https://en.ephoto360.com/....html');
//
// Proveedores, en este orden (el primero que devuelva una imagen valida gana):
//   1. ephoto360 DIRECTO: no depende de ninguna API de terceros. Hace lo mismo que el navegador:
//      abre la pagina del efecto, toma el token del formulario, manda el texto y descarga la imagen.
//   2. API de delirius (respaldo, la que usaba el bot antes).
// Si fallan todos, el error dice por que fallo cada uno (sale en `pm2 logs` como "[logo] <comando> <error>").

const BASE = 'https://en.ephoto360.com';
const CREAR_IMAGEN = `${BASE}/effect/create-image`;
const API_DELIRIUS = 'https://api.delirius.online/tools/ephoto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SESION_BASE = 'PHPSESSID=1b2hk17njmimvuim3celdji3q3';

// ---------- utilidades ----------

function decodificarHtml(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Devuelve el valor de un atributo (comillas simples o dobles) de una etiqueta HTML
function atributo(etiqueta, nombre) {
  const m = etiqueta.match(new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodificarHtml(m[1] !== undefined ? m[1] : m[2]) : null;
}

function etiquetasInput(html) {
  return html.match(/<input\b[^>]*>/gi) || [];
}

// <input id="token" value="..."> (sin importar el orden de los atributos)
function valorDeInput(html, id) {
  for (const tag of etiquetasInput(html)) {
    if (atributo(tag, 'id') === id) return atributo(tag, 'value');
  }
  return null;
}

// Igual que la libreria "qs": text:['a'] -> text[0]=a, radio0:{radio:'x'} -> radio0[radio]=x
function aFormulario(obj, prefijo = '', partes = []) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => aFormulario(v, `${prefijo}[${i}]`, partes));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) aFormulario(v, prefijo ? `${prefijo}[${k}]` : k, partes);
  } else if (prefijo) {
    partes.push(`${encodeURIComponent(prefijo)}=${encodeURIComponent(obj === null || obj === undefined ? '' : obj)}`);
  }
  return partes;
}

class Cookies {
  constructor() { this.mapa = new Map([['PHPSESSID', SESION_BASE.split('=')[1]]]); }
  guardar(res) {
    const lista = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const c of lista) {
      const m = String(c).match(/^\s*([^=;\s]+)=([^;]*)/);
      if (m) this.mapa.set(m[1], m[2]);
    }
  }
  cabecera() { return [...this.mapa].map(([k, v]) => `${k}=${v}`).join('; '); }
}

// Que tipo de archivo es, mirando los primeros bytes: 'imagen' (png/jpg/webp), 'gif', 'video' (mp4/mov/webm) o null.
function tipoMedia(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const h = buffer.subarray(0, 12);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return 'imagen'; // png
  if (h[0] === 0xff && h[1] === 0xd8) return 'imagen'; // jpg
  if (h.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') return 'imagen';
  if (h.toString('ascii', 4, 8) === 'ftyp') return 'video'; // mp4 / mov
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return 'video'; // webm / mkv
  return null;
}

function esImagen(buffer) {
  const t = tipoMedia(buffer);
  return t === 'imagen' || t === 'gif';
}

const LIMITE_VIDEO = 15 * 1024 * 1024; // WhatsApp no deja pasar videos de mas de ~16 MB

// opc.video = el efecto genera un video (mp4/gif): se acepta cualquier medio, y como el servidor tarda en
// renderizarlo, si el archivo todavia no esta listo (404 / aun no es video) se reintenta unos segundos.
async function descargar(url, ms = 25000, opc = {}) {
  const video = !!opc.video;
  const limite = Date.now() + (video ? 45000 : 0);
  let ultimo;
  for (;;) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': BASE + '/' }, signal: AbortSignal.timeout(video ? 60000 : ms) });
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${video ? 'el video' : 'el logo'}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (video ? !tipoMedia(buffer) : !esImagen(buffer)) throw new Error(video ? 'lo que se descargo no es un video ni una imagen' : 'lo que se descargo no es una imagen');
      if (video && buffer.length > LIMITE_VIDEO) throw new Error(`el video pesa ${(buffer.length / 1048576).toFixed(1)} MB y WhatsApp solo deja pasar hasta 15 MB`);
      return buffer;
    } catch (err) {
      ultimo = err;
      const msg = String((err && err.message) || err);
      if (!video || Date.now() + 3000 > limite || !/HTTP (404|403|202)\b|no es un video/.test(msg)) break;
      await new Promise((ok) => setTimeout(ok, 3000)); // todavia no esta listo: se espera y se vuelve a intentar
    }
  }
  throw ultimo;
}

// ---------- proveedor 1: ephoto360 directo ----------

const CABECERAS_BASE = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' };

function validarUrlEfecto(efectoUrl) {
  const url = String(efectoUrl);
  if (!/^https?:\/\/([a-z]+\.)?ephoto360\.com\//i.test(url)) throw new Error('el efecto no es una pagina de ephoto360');
  return url;
}

// Abre la pagina de un efecto y lee su formulario (token, servidor, cuantos textos pide, estilos, si pide imagen).
async function leerFormulario(url, cookies) {
  const pagina = await fetch(url, {
    headers: { ...CABECERAS_BASE, 'Accept': 'text/html,application/xhtml+xml', 'Cookie': cookies.cabecera() },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000)
  });
  cookies.guardar(pagina);
  const html = await pagina.text();
  const token = valorDeInput(html, 'token');
  const server = valorDeInput(html, 'build_server');
  const serverId = valorDeInput(html, 'build_server_id');
  if (!token || !server) {
    throw new Error(`la pagina del efecto no trae el formulario (HTTP ${pagina.status}${/cloudflare|just a moment|captcha/i.test(html) ? ', bloqueo anti-bots' : ''})`);
  }

  // Solo se mira el HTML de la pagina (sin <script>/<style>): "choose_file_button" aparece en el JS de TODAS las
  // paginas de ephoto360, y solo cuenta si hay un boton real de "subir imagen" en el formulario.
  const visible = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const pideImagen = /<[a-z]+\b[^>]*\bclass\s*=\s*["'][^"']*\bchoose_file_button\b/i.test(visible);
  const inputs = etiquetasInput(visible);
  const opciones = inputs.filter((t) => atributo(t, 'name') === 'radio0[radio]').map((t) => atributo(t, 'value')).filter(Boolean);
  const numTextos = inputs.filter((t) => /^text\[\]$/.test(atributo(t, 'name') || '')).length;
  return { token, server, serverId, pideImagen, opciones, numTextos, status: pagina.status };
}

// Revision rapida (sin generar nada) de un efecto: sirve para saber si una URL sigue sirviendo para logos de texto.
async function revisarEfecto(efectoUrl) {
  try {
    const f = await leerFormulario(validarUrlEfecto(efectoUrl), new Cookies());
    if (f.pideImagen && !f.numTextos) return { ok: false, motivo: 'solo pide subir una imagen (sin texto)', ...f };
    return { ok: true, motivo: `textos:${f.numTextos}, estilos:${f.opciones.length}, imagen:${f.pideImagen ? 'si' : 'no'}`, ...f };
  } catch (err) {
    return { ok: false, motivo: err && err.message ? err.message : String(err) };
  }
}

async function ephotoDirecto(texto, efectoUrl, opc = {}) {
  const url = validarUrlEfecto(efectoUrl);
  const cookies = new Cookies();
  const base = CABECERAS_BASE;

  // 1) abrir la pagina del efecto y leer el formulario
  const { token, server, serverId, pideImagen, opciones, numTextos } = await leerFormulario(url, cookies);
  if (pideImagen && !numTextos) throw new Error('este efecto solo pide subir una imagen (sin texto)');
  const camposTexto = Math.max(1, numTextos);
  const diag = `textos:${numTextos}, estilos:${opciones.length}, imagen:${pideImagen ? 'si' : 'no'}`;

  // Si el efecto pide 2 textos se separan con "|" (ej. "Panda|Bot"); lo que falte se rellena con el primero
  const dado = String(texto).split('|').map((t) => t.trim()).filter(Boolean);
  const textos = Array.from({ length: camposTexto }, (_, i) => dado[i] || dado[0] || String(texto));

  // 2) mandar el formulario con el texto
  const formulario = [
    ['submit', 'GO'], ['token', token], ['build_server', server], ['build_server_id', serverId || '1'],
    ...(opciones.length ? [['radio0[radio]', opciones[Math.floor(Math.random() * opciones.length)]]] : []),
    ['autocomplete0', ''],
    ...textos.map((t) => ['text[]', t])
  ].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  const envio = await fetch(url, {
    method: 'POST',
    headers: { ...base, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': url, 'Origin': BASE, 'Cookie': cookies.cabecera() },
    body: formulario,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });
  cookies.guardar(envio);
  const htmlEnvio = await envio.text();
  const valor = valorDeInput(htmlEnvio, 'form_value_input');
  if (!valor) throw new Error(`ephoto360 no acepto el texto (HTTP ${envio.status}, sin form_value_input; ${diag}${pideImagen ? ', el efecto tambien pide una imagen' : ''})`);

  let datos;
  try { datos = JSON.parse(valor); } catch (_) {
    try { datos = JSON.parse(valor.replace(/\\/g, '')); } catch (e) { throw new Error('no pude leer los datos del formulario de ephoto360'); }
  }

  // 3) pedir que se cree la imagen
  const creada = await fetch(CREAR_IMAGEN, {
    method: 'POST',
    headers: {
      ...base, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': url, 'Origin': BASE, 'X-Requested-With': 'XMLHttpRequest', 'Cookie': cookies.cabecera()
    },
    body: aFormulario(datos).join('&'),
    signal: AbortSignal.timeout(opc.video ? 90000 : 45000) // renderizar un video tarda mas que una imagen
  });
  const cuerpo = await creada.text();
  let resultado;
  try { resultado = JSON.parse(cuerpo); } catch (_) { throw new Error(`create-image no devolvio JSON (HTTP ${creada.status})`); }
  // En efectos de video el archivo puede venir en "image" o en "video": se prefiere el video
  const ruta = resultado && ((opc.video && resultado.video) || resultado.image || resultado.video || resultado.url);
  if (!ruta) throw new Error(`create-image sin ${opc.video ? 'video' : 'imagen'}: ${String(cuerpo).slice(0, 120)}`);

  const imagenUrl = /^https?:\/\//i.test(ruta) ? ruta : String(server).replace(/\/+$/, '') + '/' + String(ruta).replace(/^\/+/, '');
  return descargar(imagenUrl, 25000, opc);
}

// ---------- proveedor 2: API de delirius (respaldo) ----------

async function viaDelirius(texto, efectoUrl) {
  const endpoint = `${API_DELIRIUS}?effect=${encodeURIComponent(efectoUrl)}&text=${encodeURIComponent(texto)}`;
  const res = await fetch(endpoint, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  const imagen = data?.data?.image || data?.data?.url || data?.image || data?.url;
  if (!data?.status || typeof imagen !== 'string' || !/^https?:\/\//i.test(imagen)) throw new Error('respuesta sin imagen');
  return descargar(imagen);
}

// ---------- API publica ----------

const PROVEEDORES = [
  { nombre: 'ephoto360', intentos: 2, fn: ephotoDirecto },
  { nombre: 'delirius', intentos: 1, fn: viaDelirius }
];

// opc.video = el efecto genera un video: se aceptan videos/gif/imagenes y solo se usa ephoto360 directo
// (el respaldo de delirius solo devuelve imagenes).
async function generarLogo(texto, efectoUrl, proveedores = PROVEEDORES, opc = {}) {
  const fallos = [];
  for (const p of opc.video ? DIRECTO : proveedores) {
    for (let intento = 1; intento <= p.intentos; intento++) {
      try {
        const buffer = await p.fn(texto, efectoUrl, opc);
        if (opc.video ? tipoMedia(buffer) : esImagen(buffer)) return buffer;
        throw new Error(opc.video ? 'no devolvio un video' : 'no devolvio una imagen');
      } catch (err) {
        const detalle = `${p.nombre}: ${err && err.message ? err.message : err}`;
        if (intento === p.intentos) fallos.push(detalle);
      }
    }
  }
  throw new Error(fallos.join(' | ') || 'no hay proveedores de logos');
}

// ---------- varios disenos por logo ----------
// Cada comando tiene una lista de efectos del mismo tema (el primero es el "base", el de siempre).
// Se elige uno al azar; si falla, se prueba otro. Un efecto que falla se salta durante unos minutos
// (y queda avisado en los logs: "[logo] variante descartada ...").

const DIRECTO = [{ nombre: 'ephoto360', intentos: 1, fn: ephotoDirecto }];
const descartados = new Map(); // url -> cuando fallo
const DESCARTE_MS = 10 * 60 * 1000;
const PRESUPUESTO_MS = 60 * 1000; // tiempo maximo probando disenos antes de pasar al respaldo

function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fallos de TODO el sitio (caido, bloqueado, sin red): no tiene caso seguir probando otros disenos
function fallaDelSitio(motivo) {
  return /timeout|aborted|timed out|fetch failed|econn|enotfound|eai_again|bloqueo anti-bots|HTTP (403|429|5\d\d)\b/i.test(motivo);
}

// Devuelve { buffer, numero, total, efecto }: "numero" es la posicion (1..total) del diseno que salio.
// opciones.preferido = numero de diseno (1..total) que pidio el usuario: se intenta primero; si no esta
// disponible se usa otro y el "numero" devuelto es el que de verdad salio.
async function generarLogoVariado(texto, efectos, opciones = {}) {
  const lista = [...new Set((Array.isArray(efectos) ? efectos : [efectos]).filter(Boolean))];
  if (!lista.length) throw new Error('este logo no tiene efectos configurados');

  const inicio = Date.now();
  const opc = { video: !!(opciones && opciones.video) }; // efectos que generan video / gif
  const presupuesto = opc.video ? 2 * PRESUPUESTO_MS : PRESUPUESTO_MS;
  const elegido = opciones && opciones.preferido >= 1 && opciones.preferido <= lista.length ? lista[opciones.preferido - 1] : null;
  const otros = lista.filter((u) => u !== elegido);
  const vigentes = otros.filter((u) => !(descartados.get(u) > inicio - DESCARTE_MS));
  const resto = mezclar(vigentes.length ? vigentes : otros);
  const orden = elegido ? [elegido, ...resto] : resto;
  const fallos = new Map(); // motivo -> numeros de diseno que fallaron por eso

  for (const efecto of orden) {
    if (Date.now() - inicio > presupuesto) break;
    const numero = lista.indexOf(efecto) + 1;
    try {
      const buffer = await generarLogo(texto, efecto, DIRECTO, opc);
      descartados.delete(efecto);
      return { buffer, numero, total: lista.length, efecto, tipo: tipoMedia(buffer) };
    } catch (err) {
      const motivo = err && err.message ? err.message : String(err);
      descartados.set(efecto, Date.now());
      fallos.set(motivo, [...(fallos.get(motivo) || []), numero]);
      console.warn('[logo] variante descartada', efecto, '-', motivo);
      if (fallaDelSitio(motivo)) break;
    }
  }

  // Ultimo recurso: el efecto base con todos los proveedores (incluido el respaldo de delirius)
  try {
    const buffer = await generarLogo(texto, lista[0], PROVEEDORES, opc);
    return { buffer, numero: 1, total: lista.length, efecto: lista[0], tipo: tipoMedia(buffer) };
  } catch (err) {
    const partes = [...fallos].map(([motivo, nums]) => `diseno ${nums.sort().join(',')}: ${motivo}`);
    partes.push(`base: ${err && err.message ? err.message : err}`);
    throw new Error(partes.join(' || '));
  }
}

module.exports = {
  generarLogo,
  generarLogoVariado,
  revisarEfecto,
  tipoMedia,
  _interno: { aFormulario, valorDeInput, atributo, esImagen, tipoMedia, PROVEEDORES, DIRECTO, descartados, leerFormulario }
};

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

function esImagen(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const h = buffer.subarray(0, 12);
  const png = h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  const jpg = h[0] === 0xff && h[1] === 0xd8;
  const gif = h.toString('ascii', 0, 3) === 'GIF';
  const webp = h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP';
  return png || jpg || gif || webp;
}

async function descargar(url, ms = 25000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': BASE + '/' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el logo`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!esImagen(buffer)) throw new Error('lo que se descargo no es una imagen');
  return buffer;
}

// ---------- proveedor 1: ephoto360 directo ----------

async function ephotoDirecto(texto, efectoUrl) {
  const url = String(efectoUrl);
  if (!/^https?:\/\/([a-z]+\.)?ephoto360\.com\//i.test(url)) throw new Error('el efecto no es una pagina de ephoto360');
  const cookies = new Cookies();
  const base = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' };

  // 1) abrir la pagina del efecto y leer el formulario
  const pagina = await fetch(url, {
    headers: { ...base, 'Accept': 'text/html,application/xhtml+xml', 'Cookie': cookies.cabecera() },
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
  if (/choose_file_button/.test(html)) throw new Error('este efecto pide subir una imagen, no solo texto');

  const inputs = etiquetasInput(html);
  const opciones = inputs.filter((t) => atributo(t, 'name') === 'radio0[radio]').map((t) => atributo(t, 'value')).filter(Boolean);
  const camposTexto = Math.max(1, inputs.filter((t) => /^text\[\]$/.test(atributo(t, 'name') || '')).length);

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
  if (!valor) throw new Error(`ephoto360 no acepto el texto (HTTP ${envio.status}, sin form_value_input)`);

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
    signal: AbortSignal.timeout(45000)
  });
  const cuerpo = await creada.text();
  let resultado;
  try { resultado = JSON.parse(cuerpo); } catch (_) { throw new Error(`create-image no devolvio JSON (HTTP ${creada.status})`); }
  if (!resultado || !resultado.image) throw new Error(`create-image sin imagen: ${String(cuerpo).slice(0, 120)}`);

  const imagenUrl = /^https?:\/\//i.test(resultado.image) ? resultado.image : String(server).replace(/\/+$/, '') + '/' + String(resultado.image).replace(/^\/+/, '');
  return descargar(imagenUrl);
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

async function generarLogo(texto, efectoUrl, proveedores = PROVEEDORES) {
  const fallos = [];
  for (const p of proveedores) {
    for (let intento = 1; intento <= p.intentos; intento++) {
      try {
        const buffer = await p.fn(texto, efectoUrl);
        if (esImagen(buffer)) return buffer;
        throw new Error('no devolvio una imagen');
      } catch (err) {
        const detalle = `${p.nombre}: ${err && err.message ? err.message : err}`;
        if (intento === p.intentos) fallos.push(detalle);
      }
    }
  }
  throw new Error(fallos.join(' | ') || 'no hay proveedores de logos');
}

module.exports = { generarLogo, _interno: { aFormulario, valorDeInput, atributo, esImagen, PROVEEDORES } };

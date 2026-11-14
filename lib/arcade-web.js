// Mini servidor web del ARCADE (dentro del mismo proceso del bot, sin dependencias).
// Solo sirve las paginas de juego del catalogo (/flappy, ...). No hay rutas con archivos arbitrarios ni escritura.
// OJO: el link personal lleva el secreto en la URL, por eso la pagina se manda con Referrer-Policy: no-referrer
// y una CSP que le prohibe a la pagina hacer peticiones de red (no puede "mandar" el secreto a ningun lado).
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const arcade = require('./arcade');

const CARPETA = path.join(__dirname, '..', 'assets', 'arcade');

let servidor = null;
let escuchando = false;
let ultimoError = null;
let puertoActual = null;
const cachePaginas = new Map(); // archivo -> { mtimeMs, html }

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

const CABECERAS = {
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': CSP
};

const escaparHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Base publica para la imagen de la tarjeta del link (og:image debe ser una URL absoluta)
function baseParaImagen(req) {
  const cfg = arcade.leerConfigArcade();
  if (cfg.url) return cfg.url.replace(/\/+$/, '');
  const host = String(req.headers.host || '');
  if (!/^(?:[A-Za-z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/.test(host)) return null;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

function paginaDe(juego, base) {
  const ruta = path.join(CARPETA, path.basename(juego.archivo));
  const stat = fs.statSync(ruta);
  const guardada = cachePaginas.get(ruta);
  let html;
  if (guardada && guardada.mtimeMs === stat.mtimeMs) {
    html = guardada.html;
  } else {
    const nombre = escaparHtml(arcade.leerConfigArcade().nombreBot);
    html = fs.readFileSync(ruta, 'utf8').replace(/__BOT_NAME__/g, nombre);
    cachePaginas.set(ruta, { mtimeMs: stat.mtimeMs, html });
  }
  if (juego.imagen && base) return html.replace(/__OG_IMAGE__/g, escaparHtml(`${base}/${juego.id}.jpg`));
  // Sin direccion confiable: se quitan las etiquetas de imagen en vez de dejar un placeholder
  return html.split('\n').filter((l) => !/__OG_IMAGE__|og:image:/.test(l)).join('\n');
}

function imagenDe(juego) {
  if (!juego.imagen) return null;
  const ruta = path.join(CARPETA, path.basename(juego.imagen));
  try { return fs.readFileSync(ruta); } catch (_) { return null; }
}

function responder(res, codigo, tipo, cuerpo, extra = {}, soloCabeceras = false) {
  const buf = Buffer.from(cuerpo || '', 'utf8');
  res.writeHead(codigo, { ...CABECERAS, 'Content-Type': tipo, 'Content-Length': buf.length, ...extra });
  res.end(soloCabeceras ? undefined : buf);
}

function manejar(req, res) {
  const soloCabeceras = req.method === 'HEAD';
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return responder(res, 405, 'text/plain; charset=utf-8', 'Metodo no permitido', { Allow: 'GET, HEAD' });
    }
    let ruta;
    try { ruta = decodeURIComponent(new URL(req.url, 'http://arcade.local').pathname); }
    catch (_) { return responder(res, 400, 'text/plain; charset=utf-8', 'Solicitud invalida'); }

    ruta = ruta.replace(/\/+$/, '').replace(/^\//, '');
    if (ruta === 'favicon.ico') return responder(res, 204, 'image/x-icon', '', {}, true);

    // /<juego>.jpg = tarjeta que se ve al compartir el link (solo la del catalogo)
    if (/\.jpg$/.test(ruta)) {
      const dueno = arcade.juegoPorRuta(ruta.slice(0, -4));
      const img = dueno ? imagenDe(dueno) : null;
      if (!img) return responder(res, 404, 'text/plain; charset=utf-8', 'No encontrado', {}, soloCabeceras);
      res.writeHead(200, { ...CABECERAS, 'Cache-Control': 'public, max-age=3600', 'Content-Type': 'image/jpeg', 'Content-Length': img.length });
      return res.end(soloCabeceras ? undefined : img);
    }

    const juego = ruta ? arcade.juegoPorRuta(ruta) : null;
    if (!juego) {
      return responder(res, 404, 'text/plain; charset=utf-8', 'Arcade: usa el link que te dio el bot.', {}, soloCabeceras);
    }
    return responder(res, 200, 'text/html; charset=utf-8', paginaDe(juego, baseParaImagen(req)), {}, soloCabeceras);
  } catch (err) {
    console.error('[arcade] error sirviendo pagina:', err.message);
    try { responder(res, 500, 'text/plain; charset=utf-8', 'Error del servidor', {}, soloCabeceras); } catch (_) {}
  }
}

// Idempotente: el bot vuelve a llamar startBot() al reconectar, asi que esto puede invocarse varias veces
function iniciar() {
  if (servidor) return servidor;
  const puerto = arcade.leerConfigArcade().puerto;
  const srv = http.createServer(manejar);
  srv.headersTimeout = 10000;
  srv.requestTimeout = 15000;
  srv.keepAliveTimeout = 5000;
  srv.maxHeadersCount = 50;
  srv.on('error', (err) => {
    escuchando = false;
    ultimoError = err.code === 'EADDRINUSE' ? `El puerto ${puerto} ya esta ocupado por otro programa` : (err.code || err.message);
    console.error(`[arcade] servidor web no pudo iniciar: ${ultimoError}`);
    if (servidor === srv) servidor = null;
  });
  srv.on('listening', () => {
    escuchando = true;
    ultimoError = null;
    puertoActual = puerto;
    console.log(`[arcade] servidor web escuchando en el puerto ${puerto}`);
  });
  servidor = srv;
  srv.listen(puerto, '0.0.0.0');
  return srv;
}

// Solo enciende el servidor si el arcade esta en modo "link" (en modo "archivo" no se abre ningun puerto)
function iniciarSiHaceFalta() {
  if (arcade.leerConfigArcade().modo === 'link') return iniciar();
  return null;
}

function detener() {
  return new Promise((resolve) => {
    const viejo = servidor;
    servidor = null;
    escuchando = false;
    if (!viejo) return resolve();
    try { viejo.closeAllConnections && viejo.closeAllConnections(); } catch (_) {}
    viejo.close(() => resolve());
  });
}

function reiniciar() {
  return new Promise((resolve) => {
    const viejo = servidor;
    servidor = null;
    escuchando = false;
    if (!viejo) { iniciar(); return resolve(); }
    try { viejo.closeAllConnections && viejo.closeAllConnections(); } catch (_) {}
    viejo.close(() => { iniciar(); resolve(); });
  });
}

function estadoServidor() {
  return { escuchando, puerto: puertoActual || arcade.leerConfigArcade().puerto, error: ultimoError };
}

// ── URL publica: la configurada con .arcade url, o la IP publica del VPS ──
let ipCache = { ip: null, ts: 0 };

function pedirIp(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 4000 }, (res) => {
      let datos = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (datos.length < 100) datos += c; });
      res.on('end', () => resolve(/^[0-9a-fA-F:.]{3,45}$/.test(datos.trim()) ? datos.trim() : null));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function ipPublica() {
  if (ipCache.ip && Date.now() - ipCache.ts < 60 * 60 * 1000) return ipCache.ip;
  const ip = (await pedirIp('https://api.ipify.org')) || (await pedirIp('https://icanhazip.com'));
  if (ip) ipCache = { ip, ts: Date.now() };
  return ip;
}

// Devuelve { base, auto } o null si no se pudo saber la direccion
async function urlBase() {
  const cfg = arcade.leerConfigArcade();
  if (cfg.url) return { base: cfg.url.replace(/\/+$/, ''), auto: false };
  const ip = await ipPublica();
  if (!ip) return null;
  const host = ip.includes(':') ? `[${ip}]` : ip;
  return { base: `http://${host}:${estadoServidor().puerto}`, auto: true };
}

module.exports = { iniciar, iniciarSiHaceFalta, detener, reiniciar, estadoServidor, urlBase, _manejar: manejar };

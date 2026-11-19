// STICKERPACK: busca un pack en Sticker.ly (o usa un enlace sticker.ly/s/XXXX) y lo manda como
// Sticker Pack NATIVO de WhatsApp (se agrega con un solo toque). Si el Baileys o WhatsApp no lo aceptan,
// manda los stickers sueltos como respaldo.
// Adaptado de la version TypeScript que te pasaron: sin axios ni sharp (usa fetch y ffmpeg).
//   .stickerpack <busqueda o enlace>   .stickerpack debug <tema> (diagnostico)   .stickerpack probar <tema> (prueba variantes; solo owner)
const fs = require('fs');
const { spawn } = require('child_process');
const baileys = require('@whiskeysockets/baileys');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja, exito, advertencia, error: cajaError, MARCA } = require('../../lib/estilo');

let crearSticker = null;
try { ({ crearSticker } = require('../../lib/stickerlib')); } catch (_) {}

// ───────── Ajustes (editables) ─────────
const TITULO = 'STICKER PACK';
const MAX_STICKERS = 30;              // WhatsApp acepta hasta 60 por pack
const MAX_BYTES_STICKER = 1024 * 1024;
const MAX_BYTES_DESCARGA = 4 * 1024 * 1024;
const SUELTOS_RESPALDO = 10;          // si el pack nativo falla, cuantos stickers mandar sueltos
const UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

// Variantes de subida del pack nativo (ruta del servidor de WhatsApp + clave de cifrado).
// Si los stickers llegan en GRIS, un owner usa ".stickerpack probar <tema>": manda un pack por variante
// y la que se vea bien se pone en VARIANTE_ACTIVA.
const VARIANTES = [
  { n: 1, ruta: '/mms/document', hkdf: 'Sticker Pack' },     // la del comando original
  { n: 2, ruta: '/mms/sticker-pack', hkdf: 'Sticker Pack' },
  { n: 3, ruta: '/mms/document', hkdf: 'Document' },
  { n: 4, ruta: '/mms/sticker-pack', hkdf: 'Document' }
];
const VARIANTE_ACTIVA = 1;

// API de busqueda (la misma que ya usa tu .ssearch) y APIs para sacar los stickers de UN pack.
// Se prueban en orden. Si alguna cambia, solo hay que editar esta lista (o usar ".stickerpack debug <tema>").
const API_BUSQUEDA = (q) => `https://api.delirius.online/search/stickerly?query=${encodeURIComponent(q)}`;
const APIS_DETALLE = [
  (url) => `https://api.delirius.online/download/stickerly?url=${encodeURIComponent(url)}`,
  (url) => `https://api.delirius.online/tools/stickerly?url=${encodeURIComponent(url)}`
];

// ───────── Utilidades ─────────
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function esUrlSegura(valor) {
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:') return false;
    return !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname);
  } catch (_) { return false; }
}

async function pedirJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function descargar(url) {
  if (!esUrlSegura(url)) throw new Error('url no permitida');
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES_DESCARGA) throw new Error('archivo demasiado grande');
  return buf;
}

function esWebp(b) { return b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'; }

function esWebpAnimado(b) {
  if (!esWebp(b)) return false;
  let o = 12;
  while (o < b.length - 8) {
    const tag = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (tag === 'VP8X' && (b[o + 8] & 0x02) !== 0) return true;
    if (tag === 'ANIM' || tag === 'ANMF') return true;
    o += 8 + size + (size % 2);
  }
  return false;
}

// ───────── Leer las respuestas de la API (tolerante a formatos distintos) ─────────
const CLAVES_URL = ['imageUrl', 'image_url', 'url', 'image', 'src', 'sticker', 'fileUrl', 'webp', 'link'];

function urlDeItem(item) {
  if (typeof item === 'string') return /^https?:\/\//i.test(item) ? item : null;
  if (!item || typeof item !== 'object') return null;
  for (const k of CLAVES_URL) {
    if (typeof item[k] === 'string' && /^https?:\/\//i.test(item[k])) return item[k];
  }
  return null;
}

// Busca dentro del JSON el arreglo que parezca la lista de stickers
function buscarListaStickers(obj, profundidad = 0) {
  if (!obj || typeof obj !== 'object' || profundidad > 5) return null;
  if (Array.isArray(obj)) {
    const conUrl = obj.filter((x) => urlDeItem(x));
    return conUrl.length >= 2 && conUrl.length >= obj.length * 0.6 ? obj : null;
  }
  // Formato oficial de Sticker.ly: resourceUrlPrefix + resourceFiles
  if (typeof obj.resourceUrlPrefix === 'string' && Array.isArray(obj.resourceFiles)) {
    return obj.resourceFiles.map((f, i) => ({ url: obj.resourceUrlPrefix + f, isAnimated: obj.isAnimated }));
  }
  let mejor = null;
  for (const v of Object.values(obj)) {
    const r = buscarListaStickers(v, profundidad + 1);
    if (r && (!mejor || r.length > mejor.length)) mejor = r;
  }
  return mejor;
}

function normalizarPack(json, respaldoNombre = '') {
  const lista = buscarListaStickers(json);
  if (!lista) return null;
  const stickers = lista
    .map((s) => ({ url: urlDeItem(s), animado: typeof s === 'object' ? Boolean(s.isAnimated || s.animated) : false }))
    .filter((s) => s.url && esUrlSegura(s.url));
  if (stickers.length < 1) return null;

  const raiz = json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data : json?.result && typeof json.result === 'object' && !Array.isArray(json.result) ? json.result : json || {};
  const info = raiz.detalles || raiz.pack || raiz;
  return {
    nombre: String(info.name || info.title || respaldoNombre || 'Sticker Pack'),
    miniatura: [info.thumbnailUrl, info.thumbnail, info.trayIcon, info.preview, info.cover].find((u) => typeof u === 'string' && esUrlSegura(u)) || null,
    stickers
  };
}

async function buscarPacks(consulta) {
  const json = await pedirJSON(API_BUSQUEDA(consulta));
  const lista = Array.isArray(json?.data) ? json.data : Array.isArray(json?.result) ? json.result : Array.isArray(json?.resultados) ? json.resultados : [];
  return lista.filter((p) => p && !p.isPaid);
}

const urlDePack = (p) => [p?.url, p?.link, p?.packUrl, p?.pack_url].find((u) => typeof u === 'string' && /sticker\.ly\/s\//i.test(u)) || null;

async function detalleDelPack(urlPack, nombre) {
  let ultimoError = null;
  for (const construir of APIS_DETALLE) {
    try {
      const pack = normalizarPack(await pedirJSON(construir(urlPack)), nombre);
      if (pack) return pack;
    } catch (err) {
      ultimoError = err;
    }
  }
  throw new Error(ultimoError ? `La API de detalle no respondio (${ultimoError.message})` : 'La API de detalle no devolvio stickers');
}

// ───────── Conversion con ffmpeg ─────────
function correrFfmpeg(args, entrada) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args);
    const partes = [];
    const limite = setTimeout(() => { ff.kill('SIGKILL'); reject(new Error('ffmpeg tardo demasiado')); }, 20000);
    ff.stdout.on('data', (d) => partes.push(d));
    ff.stdin.on('error', () => {});
    ff.on('error', (e) => { clearTimeout(limite); reject(e); });
    ff.on('close', (code) => {
      clearTimeout(limite);
      const out = Buffer.concat(partes);
      if (code === 0 && out.length) resolve(out); else reject(new Error(`ffmpeg salio con codigo ${code}`));
    });
    if (entrada) ff.stdin.end(entrada); else ff.stdin.end();
  });
}

const ffmpegAWebp = (buffer, filtro) => correrFfmpeg(['-v', 'error', '-i', 'pipe:0', '-vf', filtro, '-vframes', '1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '70', '-f', 'webp', 'pipe:1'], buffer);
const aIcono96 = (buffer) => ffmpegAWebp(buffer, 'scale=96:96:force_original_aspect_ratio=increase,crop=96:96');
// Icono liso de 96x96: nunca falla, para que el pack jamas lleve el icono vacio
const iconoDeRespaldo = () => correrFfmpeg(['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xF1C943:s=96x96', '-frames:v', '1', '-c:v', 'libwebp', '-f', 'webp', 'pipe:1'], null);

// Icono del pack (96x96): miniatura del pack -> primer sticker no animado -> primer sticker -> icono liso
async function construirPortada(pack, listos) {
  const intentos = [];
  if (pack.miniatura) intentos.push(async () => aIcono96(await descargar(pack.miniatura)));
  const estatico = listos.find((s) => !s.isAnimated);
  if (estatico) intentos.push(async () => aIcono96(estatico.sticker));
  intentos.push(async () => aIcono96(listos[0].sticker));
  for (const intento of intentos) {
    try {
      const icono = await intento();
      if (icono && icono.length > 40) return icono;
    } catch (_) {}
  }
  try { return await iconoDeRespaldo(); } catch (_) { return Buffer.alloc(0); }
}

const FILTRO_512 = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';

async function prepararSticker(s) {
  const buf = await descargar(s.url);
  const animado = s.animado || esWebpAnimado(buf);
  if (esWebp(buf) && buf.length <= MAX_BYTES_STICKER) return { sticker: buf, isAnimated: animado, emojis: ['🎭'], url: s.url };
  if (!animado) return { sticker: await ffmpegAWebp(buf, FILTRO_512), isAnimated: false, emojis: ['🎭'], url: s.url };
  // Animado que no es webp (gif, etc.) o webp animado muy pesado: lo intenta la libreria de stickers
  if (!crearSticker) throw new Error('lib/stickerlib.js no esta instalado');
  return { sticker: await crearSticker(buf, { animado: true }), isAnimated: true, emojis: ['🎭'], url: s.url };
}

// ───────── Sticker Pack nativo (ZIP sin compresion + subida cifrada) ─────────
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function hacerZip(archivos) {
  const locales = [];
  const centrales = [];
  let offset = 0;
  for (const [nombre, datos] of Object.entries(archivos)) {
    const n = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);
    const local = Buffer.alloc(30 + n.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    n.copy(local, 30);
    locales.push(local, datos);

    const central = Buffer.alloc(46 + n.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    n.copy(central, 46);
    centrales.push(central);
    offset += local.length + datos.length;
  }
  const cd = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(centrales.length, 8);
  fin.writeUInt16LE(centrales.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, cd, fin]);
}

function soportaPackNativo() {
  return typeof baileys.encryptedStream === 'function'
    && typeof baileys.generateWAMessageFromContent === 'function'
    && typeof baileys.generateMessageIDV2 === 'function'
    && typeof baileys.sha256 === 'function'
    && baileys.MEDIA_PATH_MAP && baileys.MEDIA_HKDF_KEY_MAPPING
    && baileys.proto?.Message?.StickerPackMessage;
}

async function enviarPackNativo(sock, jid, msg, { nombre, autor, descripcion, stickers, cover, variante = VARIANTES[VARIANTE_ACTIVA - 1] }) {
  const { MEDIA_PATH_MAP, MEDIA_HKDF_KEY_MAPPING, encryptedStream, generateWAMessageFromContent, generateMessageIDV2, sha256, proto } = baileys;
  const unixTimestampSeconds = baileys.unixTimestampSeconds || (() => Math.floor(Date.now() / 1000));

  // Ruta/clave de cifrado para el tipo de media "sticker-pack" (segun la variante elegida)
  MEDIA_PATH_MAP['sticker-pack'] = variante.ruta;
  MEDIA_HKDF_KEY_MAPPING['sticker-pack'] = variante.hkdf;

  const packId = generateMessageIDV2();
  const archivos = {};
  const meta = stickers.map((s) => {
    const nombreArchivo = sha256(s.sticker).toString('base64').replace(/\//g, '-') + '.webp';
    archivos[nombreArchivo] = s.sticker;
    return { fileName: nombreArchivo, mimetype: 'image/webp', isAnimated: !!s.isAnimated, emojis: s.emojis?.length ? s.emojis : ['🎭'], accessibilityLabel: '' };
  });
  const trayIconFileName = `${packId}.webp`;
  archivos[trayIconFileName] = cover || Buffer.alloc(0);

  const zip = hacerZip(archivos);
  const up = await encryptedStream(zip, 'sticker-pack', { logger: sock.logger });

  let directPath;
  try {
    const subida = await sock.waUploadToServer(up.encFilePath, { fileEncSha256B64: up.fileEncSha256.toString('base64'), mediaType: 'sticker-pack' });
    directPath = subida.directPath;
  } finally {
    if (up.encFilePath) fs.promises.unlink(up.encFilePath).catch(() => {});
    if (up.originalFilePath) fs.promises.unlink(up.originalFilePath).catch(() => {});
  }
  if (!directPath) throw new Error('WhatsApp no devolvio la ruta del pack subido');
  console.log('[stickerpack] pack subido:', JSON.stringify({ variante: variante.n, ruta: variante.ruta, hkdf: variante.hkdf, stickers: stickers.length, zip: zip.length, icono: cover ? cover.length : 0, directPath }));

  const contenido = {
    stickerPackMessage: {
      name: nombre,
      publisher: autor,
      packDescription: descripcion,
      stickerPackId: packId,
      stickerPackOrigin: proto.Message.StickerPackMessage.StickerPackOrigin.THIRD_PARTY,
      stickerPackSize: zip.length,
      stickers: meta,
      fileSha256: up.fileSha256,
      fileEncSha256: up.fileEncSha256,
      mediaKey: up.mediaKey,
      directPath,
      fileLength: up.fileLength,
      mediaKeyTimestamp: unixTimestampSeconds(),
      trayIconFileName
    }
  };

  const userJid = sock.user?.id;
  const citado = msg && msg.key ? msg : undefined;
  let m;
  try { m = generateWAMessageFromContent(jid, contenido, { quoted: citado, userJid }); }
  catch (_) { m = generateWAMessageFromContent(jid, contenido, { userJid }); }

  try {
    await sock.relayMessage(jid, m.message, { messageId: m.key.id });
  } catch (_) {
    // Si WhatsApp rechaza la referencia al mensaje citado, se reintenta sin citar
    m = generateWAMessageFromContent(jid, contenido, { userJid });
    await sock.relayMessage(jid, m.message, { messageId: m.key.id });
  }
  return m;
}

// ───────── Comando ─────────
module.exports = {
  name: 'stickerpack',
  aliases: ['spack', 'packsticker', 'packly'],
  category: 'tools',
  description: 'Busca un pack en Sticker.ly y lo manda como Sticker Pack nativo de WhatsApp. Uso: .stickerpack <tema o enlace>',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const args = String(texto || '').trim().split(/\s+/).slice(1).filter(Boolean);
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const reaccionar = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => undefined);

    // ───── modo diagnostico (solo owner) ─────
    if ((args[0] || '').toLowerCase() === 'debug') {
      if (!(await esOwnerBot(sock, leerConfig(), msg))) return responder(advertencia('Solo un owner puede usar el diagnostico.', { titulo: TITULO }));
      const consulta = args.slice(1).join(' ').trim() || 'goku';
      const lineas = [];
      try {
        const json = await pedirJSON(API_BUSQUEDA(consulta));
        const lista = Array.isArray(json?.data) ? json.data : [];
        lineas.push(`🔎 Busqueda "${consulta}": ${lista.length} packs`);
        if (lista[0]) lineas.push(`Campos del 1er pack: ${Object.keys(lista[0]).join(', ')}`, `url del pack: ${urlDePack(lista[0]) || 'NO ENCONTRADA'}`);
        const url = lista.map(urlDePack).find(Boolean);
        if (url) {
          for (const [i, construir] of APIS_DETALLE.entries()) {
            try {
              const j = await pedirJSON(construir(url));
              const pack = normalizarPack(j);
              lineas.push(`🧩 Detalle #${i + 1}: ${pack ? `${pack.stickers.length} stickers ("${pack.nombre}")` : 'respondio pero no pude leer stickers'} · campos: ${Object.keys(j || {}).join(', ')}`);
            } catch (err) { lineas.push(`🧩 Detalle #${i + 1}: fallo (${err.message})`); }
          }
        }
      } catch (err) { lineas.push(`❌ La busqueda fallo: ${err.message}`); }
      lineas.push(`📦 Pack nativo soportado por este Baileys: ${soportaPackNativo() ? 'SI' : 'NO (mandare stickers sueltos)'}`);
      lineas.push(`🔧 Variante activa: ${VARIANTE_ACTIVA} (${VARIANTES[VARIANTE_ACTIVA - 1].ruta} + ${VARIANTES[VARIANTE_ACTIVA - 1].hkdf})`);
      return responder(caja(lineas, { titulo: 'DIAGNOSTICO STICKERPACK' }));
    }

    const modoProbar = (args[0] || '').toLowerCase() === 'probar';
    if (modoProbar && !(await esOwnerBot(sock, leerConfig(), msg))) {
      return responder(advertencia('Solo un owner puede usar el modo de prueba.', { titulo: TITULO }));
    }
    const consulta = (modoProbar ? args.slice(1) : args).join(' ').trim();
    if (!consulta) {
      return responder(caja([
        `Uso: ${prefix}stickerpack <tema o enlace de Sticker.ly>`,
        `Ejemplo: ${prefix}stickerpack goku`,
        `Enlace: ${prefix}stickerpack https://sticker.ly/s/XZ2POC`,
        '',
        'Lo manda como pack nativo de WhatsApp para agregarlo con un toque.'
      ], { titulo: TITULO }));
    }

    await reaccionar('⏳');
    try {
      let pack = null;
      const enlace = consulta.match(/https?:\/\/sticker\.ly\/s\/[a-zA-Z0-9_-]+/i);

      if (enlace) {
        pack = await detalleDelPack(enlace[0], '');
      } else {
        const candidatos = await buscarPacks(consulta);
        if (!candidatos.length) {
          await reaccionar('❌');
          return responder(advertencia(`No encontre packs para "${consulta}". Prueba con otro tema.`, { titulo: TITULO }));
        }
        for (const c of candidatos.slice(0, 8)) {
          const url = urlDePack(c);
          const nombreC = c.name || c.title || consulta;
          pack = null;
          if (url) { try { pack = await detalleDelPack(url, nombreC); } catch (_) {} }
          if (!pack) pack = normalizarPack(c, nombreC);
          if (pack && pack.stickers.length >= 2) break;
          pack = null;
        }
      }

      if (!pack) {
        await reaccionar('❌');
        return responder(cajaError(`No pude sacar los stickers de ese pack.\nUn owner puede revisar la API con: ${prefix}stickerpack debug ${enlace ? 'goku' : consulta}`, { titulo: TITULO }));
      }

      const crudos = pack.stickers.slice(0, MAX_STICKERS);
      await responder(caja([`Pack: *${pack.nombre}*`, `Stickers: ${crudos.length}`, '⏳ Descargando y empaquetando...'], { titulo: TITULO }));

      // Descarga en lotes de 3 para cuidar CPU y memoria
      const listos = [];
      for (let i = 0; i < crudos.length; i += 3) {
        const lote = await Promise.allSettled(crudos.slice(i, i + 3).map(prepararSticker));
        for (const r of lote) {
          if (r.status === 'fulfilled' && r.value.sticker.length > 0 && r.value.sticker.length <= MAX_BYTES_STICKER) listos.push(r.value);
        }
      }
      if (!listos.length) throw new Error('No se pudo convertir ningun sticker del pack.');

      const cover = await construirPortada(pack, listos);

      const nombreBot = MARCA || 'BOT';
      const autor = `${nombreBot} • ${msg.pushName || 'Usuario'}`.slice(0, 30).trim();
      const nombre = pack.nombre.slice(0, 30).trim();
      const descripcion = `${pack.nombre} - ${nombreBot}`.slice(0, 60).trim();

      if (modoProbar) {
        if (!soportaPackNativo()) return responder(cajaError('Este Baileys no soporta pack nativo, no hay nada que probar.', { titulo: TITULO }));
        const resumen = [];
        for (const v of VARIANTES) {
          try {
            await enviarPackNativo(sock, jid, msg, { nombre: `${nombre.slice(0, 24)} V${v.n}`.trim(), autor, descripcion: `${descripcion} [variante ${v.n}]`.slice(0, 60), stickers: listos, cover, variante: v });
            resumen.push(`✅ Variante ${v.n} enviada (${v.ruta} + ${v.hkdf})`);
          } catch (err) {
            resumen.push(`❌ Variante ${v.n} fallo: ${err.message}`);
          }
          await dormir(1500);
        }
        await reaccionar('✅');
        return responder(caja([...resumen, '', 'Abre cada pack: el que muestre los stickers (no en gris) es el bueno. Dime su numero (V1, V2...).'], { titulo: 'PRUEBA DE VARIANTES' }));
      }

      if (soportaPackNativo()) {
        try {
          await enviarPackNativo(sock, jid, msg, { nombre, autor, descripcion, stickers: listos, cover });
          await reaccionar('✅');
          return;
        } catch (err) {
          console.error('[stickerpack] el pack nativo fallo, mando stickers sueltos:', err.message);
        }
      }

      // Respaldo: stickers sueltos
      await responder(advertencia(`No pude mandarlo como pack nativo, te mando ${Math.min(SUELTOS_RESPALDO, listos.length)} stickers sueltos.`, { titulo: TITULO }));
      for (const s of listos.slice(0, SUELTOS_RESPALDO)) {
        await sock.sendMessage(jid, { sticker: s.sticker }).catch(() => undefined);
        await dormir(700);
      }
      await reaccionar('✅');
    } catch (err) {
      console.error('[stickerpack]', err);
      await reaccionar('❌');
      await responder(cajaError(err.message || 'Error al procesar el pack de stickers.', { titulo: TITULO }));
    }
  },
  _test: { normalizarPack, buscarListaStickers, hacerZip, crc32, esWebpAnimado, urlDePack, construirPortada, iconoDeRespaldo, VARIANTES }
};

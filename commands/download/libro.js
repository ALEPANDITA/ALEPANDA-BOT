// LIBRO: busca libros EN ESPAÑOL en archive.org y manda el PDF como archivo.
//   .libro quijote cervantes   -> muestra una lista numerada
//   .libro 2                   -> descarga y manda el libro numero 2 de tu ultima busqueda
// Solo aparecen libros que Archive.org ofrece para DESCARGA LIBRE (en su mayoria de dominio publico o con licencias abiertas).
// Los prestamos controlados (los que piden cuenta y devolver el libro) se excluyen y no se pueden bajar con este comando.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

const SITIO = 'https://archive.org';
const UA = 'ALEPANDA-BOT/1.0 (bot de WhatsApp; libros de descarga libre de archive.org)';
const LIMITE_MB = 80;                       // WhatsApp acepta ~100 MB; dejamos margen
const MAX_RESULTADOS = 6;
const VIDA_BUSQUEDA_MS = 15 * 60 * 1000;    // la lista queda disponible 15 minutos
const ESPERA_ENTRE_DESCARGAS_MS = 20 * 1000;
const MAX_DESCARGAS_A_LA_VEZ = 2;
const TIMEOUT_BUSCAR_MS = 20 * 1000;
const TIMEOUT_DESCARGA_MS = 5 * 60 * 1000;
const ESTILO = { titulo: 'LIBROS', estilo: 'neon' };

const busquedas = new Map();   // "chat|usuario" -> { ts, items }
const ultimaDescarga = new Map();
let descargasActivas = 0;
const enUso = new Set();

const texto1 = (v) => String(Array.isArray(v) ? v[0] : (v == null ? '' : v)).replace(/\s+/g, ' ').trim();
const mb = (bytes) => (bytes / 1048576).toFixed(1);

async function pedirJSON(url, timeoutMs) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('archive.org respondio ' + res.status);
  return res.json();
}

// Arma la busqueda: cada palabra debe estar en el titulo o en el autor; solo textos en español y que NO sean de prestamo
function armarConsulta(palabras) {
  const porPalabra = palabras.map((p) => `(title:(${p}) OR creator:(${p}))`).join(' AND ');
  return `${porPalabra} AND mediatype:texts AND (language:spa OR language:Spanish OR language:es OR language:spanish)` +
    ' AND NOT collection:(inlibrary) AND NOT collection:(printdisabled) AND NOT access-restricted-item:true';
}

async function buscar(palabras) {
  const params = new URLSearchParams({ q: armarConsulta(palabras), rows: '15', page: '1', output: 'json' });
  for (const f of ['identifier', 'title', 'creator', 'year', 'downloads']) params.append('fl[]', f);
  params.append('sort[]', 'downloads desc');
  const json = await pedirJSON(`${SITIO}/advancedsearch.php?${params}`, TIMEOUT_BUSCAR_MS);
  const vistos = new Set();
  const items = [];
  for (const d of (json && json.response && json.response.docs) || []) {
    const id = texto1(d.identifier);
    if (!/^[A-Za-z0-9._-]+$/.test(id) || vistos.has(id)) continue;
    vistos.add(id);
    items.push({ id, titulo: texto1(d.title) || id, autor: texto1(d.creator), anio: texto1(d.year) });
    if (items.length >= MAX_RESULTADOS) break;
  }
  return items;
}

// Elige el PDF a mandar: el que tiene el texto del libro y que quepa en el limite
function elegirPDF(archivos) {
  const preferencia = ['Text PDF', 'Additional Text PDF', 'Image Container PDF'];
  const pdfs = (archivos || []).filter((f) => /\.pdf$/i.test(f.name || '') && Number(f.size) > 0)
    .map((f) => ({ nombre: f.name, bytes: Number(f.size), rango: preferencia.indexOf(f.format) === -1 ? preferencia.length : preferencia.indexOf(f.format) }))
    .sort((a, b) => a.rango - b.rango || b.bytes - a.bytes);
  if (!pdfs.length) return { motivo: 'sin_pdf' };
  const cabe = pdfs.find((p) => p.bytes <= LIMITE_MB * 1048576);
  return cabe ? { pdf: cabe } : { motivo: 'grande', bytes: pdfs[0].bytes };
}

async function bajarArchivo(url, destino) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) });
  if (!res.ok || !res.body) throw new Error('la descarga respondio ' + res.status);
  const tope = LIMITE_MB * 1048576;
  const declarado = Number(res.headers.get('content-length') || 0);
  if (declarado > tope) throw new Error('muy_grande');
  let total = 0;
  const entrada = Readable.fromWeb(res.body);
  entrada.on('data', (trozo) => { total += trozo.length; if (total > tope) entrada.destroy(new Error('muy_grande')); });
  await pipeline(entrada, fs.createWriteStream(destino));
  return total;
}

function nombreSeguro(titulo, autor) {
  const base = (autor ? `${titulo} - ${autor}` : titulo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .,()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  return (base || 'libro') + '.pdf';
}

async function descargarLibro(sock, jid, msg, item) {
  const ficha = await pedirJSON(`${SITIO}/metadata/${encodeURIComponent(item.id)}`, TIMEOUT_BUSCAR_MS);
  const meta = (ficha && ficha.metadata) || {};
  const colecciones = [].concat(meta.collection || []).map(String);
  if (String(meta['access-restricted-item']).toLowerCase() === 'true' || colecciones.some((c) => /^(inlibrary|printdisabled)$/i.test(c)) || ficha.is_dark) {
    return sock.sendMessage(jid, { text: advertencia('Ese libro es de *préstamo controlado* en archive.org (hay que iniciar sesión y pedirlo prestado), así que no se puede descargar desde aquí.', ESTILO) }, { quoted: msg });
  }
  const eleccion = elegirPDF(ficha.files);
  const enlace = `${SITIO}/details/${item.id}`;
  if (eleccion.motivo === 'sin_pdf') {
    return sock.sendMessage(jid, { text: advertencia(`Ese libro no tiene archivo PDF en archive.org.\nPuedes verlo aquí: ${enlace}`, ESTILO) }, { quoted: msg });
  }
  if (eleccion.motivo === 'grande') {
    return sock.sendMessage(jid, { text: advertencia(`El PDF pesa *${mb(eleccion.bytes)} MB* y WhatsApp solo deja mandar hasta ~${LIMITE_MB} MB.\nDescárgalo aquí: ${enlace}`, ESTILO) }, { quoted: msg });
  }
  const { pdf } = eleccion;
  await sock.sendMessage(jid, { text: `📥 Descargando *${item.titulo}* (${mb(pdf.bytes)} MB)... puede tardar un poco.` }, { quoted: msg });
  const temporal = path.join(os.tmpdir(), `libro-${process.pid}-${Date.now()}.pdf`);
  try {
    await bajarArchivo(`${SITIO}/download/${encodeURIComponent(item.id)}/${encodeURIComponent(pdf.nombre)}`, temporal);
    const pie = [`📚 *${item.titulo}*`, item.autor && `✍️ ${item.autor}`, item.anio && `📅 ${item.anio}`, `🔗 ${enlace}`].filter(Boolean).join('\n');
    await sock.sendMessage(jid, { document: { url: temporal }, mimetype: 'application/pdf', fileName: nombreSeguro(item.titulo, item.autor), caption: pie }, { quoted: msg });
  } finally {
    fs.unlink(temporal, () => {});
  }
}

module.exports = {
  name: 'libro',
  aliases: ['libros', 'ebook', 'pdf'],
  category: 'download',
  description: 'Busca libros en español en archive.org y manda el PDF. Ej: .libro quijote  y luego  .libro 1',
  _armarConsulta: armarConsulta,
  _elegirPDF: elegirPDF,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const llave = `${jid}|${remitente}`;
    const pedido = String(texto || '').trim().split(/\s+/).slice(1).join(' ').trim();

    if (!pedido) {
      return sock.sendMessage(jid, { text: advertencia(`Dime qué libro buscas.\nEj: ${prefix}libro quijote\nEj: ${prefix}libro cien años de soledad\nDespués elige un número: ${prefix}libro 2\n\n_Solo salen libros de descarga libre de archive.org (la mayoría de dominio público)._`, ESTILO) }, { quoted: msg });
    }

    // ---- ".libro 2": descargar de la ultima busqueda ----
    if (/^\d{1,2}$/.test(pedido)) {
      const ultima = busquedas.get(llave);
      if (!ultima || Date.now() - ultima.ts > VIDA_BUSQUEDA_MS) {
        return sock.sendMessage(jid, { text: advertencia(`Primero busca un libro. Ej: ${prefix}libro quijote`, ESTILO) }, { quoted: msg });
      }
      const item = ultima.items[Number(pedido) - 1];
      if (!item) return sock.sendMessage(jid, { text: advertencia(`Elige un número del 1 al ${ultima.items.length}.`, ESTILO) }, { quoted: msg });
      if (enUso.has(remitente)) return sock.sendMessage(jid, { text: advertencia('Ya tienes una descarga en curso, espera a que termine. ⏳', ESTILO) }, { quoted: msg });
      const falta = ESPERA_ENTRE_DESCARGAS_MS - (Date.now() - (ultimaDescarga.get(remitente) || 0));
      if (falta > 0) return sock.sendMessage(jid, { text: advertencia(`Espera ${Math.ceil(falta / 1000)} segundos para pedir otro libro. ⏳`, ESTILO) }, { quoted: msg });
      if (descargasActivas >= MAX_DESCARGAS_A_LA_VEZ) return sock.sendMessage(jid, { text: advertencia('Hay muchas descargas en este momento. Intenta de nuevo en un minuto.', ESTILO) }, { quoted: msg });
      enUso.add(remitente); descargasActivas++; ultimaDescarga.set(remitente, Date.now());
      try {
        await descargarLibro(sock, jid, msg, item);
      } catch (err) {
        console.error('[libro]', err && err.message ? err.message : err);
        const grande = err && err.message === 'muy_grande';
        await sock.sendMessage(jid, { text: cajaError(grande ? `El archivo pasa de ${LIMITE_MB} MB y no se puede mandar por WhatsApp.` : 'No pude descargar ese libro ahorita. Intenta de nuevo en un momento o prueba con otro.', ESTILO) }, { quoted: msg });
      } finally {
        enUso.delete(remitente); descargasActivas--;
      }
      return;
    }

    // ---- ".libro <busqueda>": mostrar lista ----
    const palabras = pedido.toLowerCase().normalize('NFC').replace(/["'():\[\]{}\\\/^~*?!+\-<>=&|]/g, ' ').split(/\s+/).filter((p) => p.length >= 2).slice(0, 6);
    if (!palabras.length) return sock.sendMessage(jid, { text: advertencia('Escribe al menos una palabra del título o del autor.', ESTILO) }, { quoted: msg });
    try {
      const items = await buscar(palabras);
      if (!items.length) {
        return sock.sendMessage(jid, { text: advertencia(`No encontré libros en español de descarga libre para *${pedido}*.\nPrueba con menos palabras o con el apellido del autor (los libros recientes casi siempre son de préstamo y no aparecen).`, ESTILO) }, { quoted: msg });
      }
      busquedas.set(llave, { ts: Date.now(), items });
      const lista = items.map((it, i) => `*${i + 1}.* ${it.titulo.slice(0, 80)}${it.autor ? `\n    ✍️ ${it.autor.slice(0, 50)}` : ''}${it.anio ? ` · ${it.anio}` : ''}`).join('\n');
      return sock.sendMessage(jid, { text: exito(`${lista}\n\n👉 Para bajarlo escribe: *${prefix}libro <número>*\nEj: ${prefix}libro 1`, { titulo: 'LIBROS EN ESPAÑOL', estilo: 'neon' }) }, { quoted: msg });
    } catch (err) {
      console.error('[libro buscar]', err && err.message ? err.message : err);
      return sock.sendMessage(jid, { text: cajaError('No pude consultar archive.org ahorita. Intenta de nuevo en un momento.', ESTILO) }, { quoted: msg });
    }
  }
};

const { caja, advertencia, error: cajaError, cargando, porCategoria } = require('../../lib/estilo');

// .manga <nombre>                 -> ficha del manga y capítulos disponibles en español
// .manga <nombre> | <capítulo>    -> manda ese capítulo en PDF   (también: .manga <nombre> cap 5)
// .manga <nombre> | 3-5           -> manda varios capítulos, un PDF por capítulo (máx. MAX_RANGO)
// API: https://api.mangadex.org  (solo capítulos en español: "es" y "es-la")

const API = 'https://api.mangadex.org';
const UA = 'ALEPANDA-BOT/1.0 (bot de WhatsApp)';
const IDIOMAS = ['es', 'es-la'];
const RATING = ['safe', 'suggestive', 'erotica'];
const MAX_RANGO = 5;                    // capítulos por pedido
const CONCURRENCIA = 4;                 // imágenes que se bajan a la vez
const USAR_DATA_SAVER = true;           // true: imágenes ligeras (rápido). false: calidad original
const MAX_PAGINA_PDF = 14000;           // límite de tamaño de página del formato PDF
const MAX_PDF_BYTES = 95 * 1024 * 1024; // WhatsApp no deja pasar mucho más
const TIMEOUT_API = 20000;
const TIMEOUT_IMG = 30000;
const CACHE_MS = 10 * 60 * 1000;

const cacheCapitulos = new Map();       // idManga -> { t, caps }
const ocupados = new Set();             // un pedido a la vez por chat

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const getFetch = () => globalThis.fetch || require('node-fetch');
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------------- red ----------------
async function pedir(url, { tipo = 'json', timeout = TIMEOUT_API, reintentos = 2 } = {}) {
  let ultimo;
  for (let intento = 0; intento <= reintentos; intento++) {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await getFetch()(url, {
        headers: { 'User-Agent': UA, Accept: tipo === 'json' ? 'application/json' : '*/*' },
        signal: ctrl.signal
      });
      if (res.status === 429) {
        ultimo = new Error('MangaDex está recibiendo muchas peticiones, intenta de nuevo en un momento');
        await esperar(Math.min(Number(res.headers.get('retry-after')) || 2, 8) * 1000);
        continue;
      }
      if (!res.ok) {
        const e = new Error(`MangaDex respondió ${res.status}`);
        if (res.status >= 400 && res.status < 500) e.sinReintento = true;
        throw e;
      }
      return tipo === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      ultimo = e.name === 'AbortError' ? new Error('MangaDex tardó demasiado en responder') : e;
      if (e.sinReintento) throw ultimo;
      if (intento < reintentos) await esperar(700 * (intento + 1));
    } finally {
      clearTimeout(reloj);
    }
  }
  throw ultimo;
}

function parametros(pares) {
  const p = new URLSearchParams();
  for (const [k, v] of pares) p.append(k, v);
  return p.toString();
}
const ratingParams = () => RATING.map((r) => ['contentRating[]', r]);
const idiomaParams = (campo) => IDIOMAS.map((i) => [campo, i]);

// ---------------- MangaDex ----------------
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Si pegan el enlace de MangaDex (o el ID) se usa ese manga; si no, se busca por nombre.
// La búsqueda NO filtra por idioma: lo del español se revisa después en los capítulos de cada resultado.
async function buscarMangas(query) {
  const id = (query.match(UUID) || [])[0];
  if (id) {
    try {
      const json = await pedir(`${API}/manga/${id}?` + parametros([['includes[]', 'cover_art']]));
      return json.data ? [json.data] : [];
    } catch (e) {
      if (/respondió 404/.test(e.message)) return [];
      throw e;
    }
  }
  const json = await pedir(`${API}/manga?` + parametros([
    ['title', query], ['limit', '8'], ['order[relevance]', 'desc'], ['includes[]', 'cover_art'], ...ratingParams()
  ]));
  return Array.isArray(json.data) ? json.data : [];
}

function tituloDe(manga) {
  const a = manga.attributes || {};
  const t = a.title || {};
  const alt = Array.isArray(a.altTitles) ? a.altTitles : [];
  const altEs = alt.map((o) => o.es || o['es-la']).find(Boolean);
  return t.es || t['es-la'] || altEs || t.en || Object.values(t)[0] || 'Sin título';
}

function sinopsisDe(manga) {
  const d = (manga.attributes || {}).description || {};
  let s = d.es || d['es-la'] || d.en || '';
  s = s.split(/\n\s*---/)[0]                       // lo de abajo del "---" suelen ser enlaces
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // [texto](url) -> texto
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/\s+/g, ' ').trim();
  return s.length > 350 ? s.slice(0, 347).trimEnd() + '...' : s;
}

function portadaDe(manga) {
  const rel = (manga.relationships || []).find((r) => r.type === 'cover_art');
  const archivo = rel && rel.attributes && rel.attributes.fileName;
  return archivo ? `https://uploads.mangadex.org/covers/${manga.id}/${archivo}.512.jpg` : null;
}

const ESTADOS = { ongoing: 'En emisión', completed: 'Finalizado', hiatus: 'En pausa', cancelled: 'Cancelado' };

function claveDe(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 'oneshot';
  const t = String(valor).trim().toLowerCase();
  return /^\d+(\.\d+)?$/.test(t) ? String(parseFloat(t)) : t;
}

// Capítulos descargables en español, uno por número (si varios grupos lo subieron, quedan como alternativas).
// También cuenta los capítulos en español que están en enlaces externos (MANGA Plus, etc.): esos no se pueden bajar.
// Devuelve { caps, externos }.
async function capitulosDe(mangaId) {
  const guardado = cacheCapitulos.get(mangaId);
  if (guardado && Date.now() - guardado.t < CACHE_MS) return guardado;

  const todos = [];
  for (let pagina = 0; pagina < 8; pagina++) {
    const offset = pagina * 500;
    const json = await pedir(`${API}/manga/${mangaId}/feed?` + parametros([
      ['limit', '500'], ['offset', String(offset)], ['order[chapter]', 'asc'],
      ['includeExternalUrl', '1'],
      ...idiomaParams('translatedLanguage[]'), ...ratingParams()
    ]));
    const datos = Array.isArray(json.data) ? json.data : [];
    todos.push(...datos);
    if (!datos.length || offset + 500 >= (json.total || 0)) break;
    await esperar(250);
  }

  const porClave = new Map();
  const clavesExternas = new Set();
  for (const ch of todos) {
    const a = ch.attributes || {};
    const clave = claveDe(a.chapter);
    if (a.externalUrl) { clavesExternas.add(clave); continue; }   // alojado fuera de MangaDex: no se puede bajar
    if (a.pages === 0) continue;                                  // sin páginas
    if (!porClave.has(clave)) {
      const numerico = /^\d+(\.\d+)?$/.test(clave) ? parseFloat(clave) : null;
      porClave.set(clave, { clave, n: numerico, etiqueta: clave === 'oneshot' ? 'Oneshot' : (numerico !== null ? clave : String(a.chapter).trim()), opciones: [] });
    }
    porClave.get(clave).opciones.push({ id: ch.id, paginas: Number(a.pages) || 0, titulo: a.title || '' });
  }

  const caps = [...porClave.values()].sort((x, y) => {
    if (x.n !== null && y.n !== null) return x.n - y.n;
    if (x.n !== null) return -1;
    if (y.n !== null) return 1;
    return x.clave.localeCompare(y.clave);
  });
  for (const c of caps) c.opciones.sort((x, y) => y.paginas - x.paginas).splice(2); // la versión más completa primero, 1 alternativa

  const externos = [...clavesExternas].filter((k) => !porClave.has(k)).length;
  const resultado = { t: Date.now(), caps, externos };
  cacheCapitulos.set(mangaId, resultado);
  return resultado;
}

// El primer resultado que tenga capítulos descargables en español. Si ninguno tiene, devuelve lo revisado para explicarlo.
async function elegirManga(resultados) {
  const saltados = [];
  for (let i = 0; i < Math.min(resultados.length, 5); i++) {
    if (i > 0) await esperar(250);
    const { caps, externos } = await capitulosDe(resultados[i].id);
    if (caps.length) return { manga: resultados[i], caps, saltados };
    saltados.push({ manga: resultados[i], externos });
  }
  return { manga: null, caps: [], saltados };
}

function resumirCapitulos(caps) {
  const partes = [];
  let ini = null;
  let prev = null;
  const cerrar = () => { if (ini !== null) partes.push(ini === prev ? `${ini}` : `${ini}-${prev}`); };
  for (const c of caps) {
    const v = c.n !== null ? c.n : c.etiqueta;
    if (typeof v === 'number' && Number.isInteger(v) && typeof prev === 'number' && Number.isInteger(prev) && v === prev + 1) {
      prev = v;
      continue;
    }
    cerrar();
    ini = v;
    prev = v;
  }
  cerrar();
  const texto = partes.join(', ');
  return texto.length > 350 ? texto.slice(0, 347).trimEnd() + '...' : texto;
}

// ---------------- páginas -> PDF ----------------
async function urlsDePaginas(capituloId) {
  const info = await pedir(`${API}/at-home/server/${capituloId}`);
  const c = info.chapter || {};
  const ligero = USAR_DATA_SAVER && Array.isArray(c.dataSaver) && c.dataSaver.length;
  const archivos = ligero ? c.dataSaver : (c.data || []);
  const ruta = ligero ? 'data-saver' : 'data';
  return archivos.map((f) => `${info.baseUrl}/${ruta}/${c.hash}/${f}`);
}

async function descargarImagenes(urls) {
  const salida = new Array(urls.length);
  let siguiente = 0;
  let fallo = null;
  const trabajador = async () => {
    while (!fallo) {
      const i = siguiente++;
      if (i >= urls.length) return;
      try {
        salida[i] = await pedir(urls[i], { tipo: 'buffer', timeout: TIMEOUT_IMG, reintentos: 1 });
      } catch (e) {
        fallo = e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, urls.length) }, trabajador));
  if (fallo) throw fallo;
  return salida;
}

const esJpeg = (b) => b.length > 3 && b[0] === 0xFF && b[1] === 0xD8;
const esPng = (b) => b.length > 3 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;

// El PDF solo acepta JPG y PNG; cualquier otro formato (webp, gif...) se convierte.
async function convertirAJpeg(buf) {
  const { loadImage, createCanvas } = require('@napi-rs/canvas');
  const img = await loadImage(buf);
  const lienzo = createCanvas(img.width, img.height);
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  return lienzo.toBuffer('image/jpeg', 90);
}

async function abrirImagen(doc, buf) {
  if (esJpeg(buf) || esPng(buf)) {
    try { return doc.openImage(buf); } catch (_) { /* PNG raro: se convierte abajo */ }
  }
  return doc.openImage(await convertirAJpeg(buf));
}

async function armarPdf(imagenes, titulo) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (_) {
    throw new Error('falta instalar pdfkit en el servidor (npm install)');
  }
  const doc = new PDFDocument({ autoFirstPage: false, info: { Title: titulo, Author: 'MangaDex' } });
  const trozos = [];
  doc.on('data', (t) => trozos.push(t));
  const terminado = new Promise((resolver, rechazar) => {
    doc.on('end', () => resolver(Buffer.concat(trozos)));
    doc.on('error', rechazar);
  });
  try {
    for (const buf of imagenes) {
      const img = await abrirImagen(doc, buf);
      const escala = Math.min(1, MAX_PAGINA_PDF / img.width, MAX_PAGINA_PDF / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      doc.addPage({ size: [w, h], margin: 0 });
      doc.image(img, 0, 0, { width: w, height: h });
    }
    doc.end();
  } catch (e) {
    doc.end();
    throw e;
  }
  return terminado;
}

// Prueba la versión del capítulo (y otra de otro grupo si falla); pide un servidor de imágenes nuevo en cada intento.
async function generarPdf(cap, titulo) {
  let ultimo = new Error('No se pudo descargar el capítulo');
  for (const op of cap.opciones) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const urls = await urlsDePaginas(op.id);
        if (!urls.length) throw new Error('El capítulo no tiene páginas');
        const imagenes = await descargarImagenes(urls);
        const buffer = await armarPdf(imagenes, `${titulo} - Capítulo ${cap.etiqueta}`);
        return { buffer, paginas: urls.length };
      } catch (e) {
        ultimo = e;
        await esperar(1000);
      }
    }
  }
  throw ultimo;
}

// ---------------- texto del usuario ----------------
function interpretar(texto) {
  const resto = String(texto || '').trim().split(/\s+/).slice(1).join(' ').trim();
  if (resto.includes('|')) {
    const [a, ...b] = resto.split('|');
    return { titulo: a.trim(), cap: b.join('|').trim(), conCap: true };
  }
  const m = resto.match(/^(.*\S)\s+cap(?:[ií]tulos?|s)?\.?\s*#?\s*(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?|oneshot|unico|único)\s*$/i);
  if (m) return { titulo: m[1].trim(), cap: m[2].trim(), conCap: true };
  return { titulo: resto, cap: '', conCap: false };
}

function interpretarCap(s) {
  const t = sinAcentos(s).toLowerCase().trim();
  if (!t) return null;
  if (t === 'oneshot' || t === 'unico') return { tipo: 'oneshot' };
  const r = t.match(/^(\d+(?:\.\d+)?)\s*(?:-|a|al|hasta)\s*(\d+(?:\.\d+)?)$/);
  if (r) return { tipo: 'rango', desde: parseFloat(r[1]), hasta: parseFloat(r[2]) };
  if (/^\d+(\.\d+)?$/.test(t)) return { tipo: 'uno', n: parseFloat(t) };
  if (/^[0-9a-z.]+$/.test(t)) return { tipo: 'clave', clave: t };
  return null;
}

function seleccionar(caps, cap) {
  if (cap.tipo === 'oneshot') return caps.filter((c) => c.clave === 'oneshot');
  if (cap.tipo === 'uno') return caps.filter((c) => c.n === cap.n);
  if (cap.tipo === 'clave') return caps.filter((c) => c.clave === cap.clave);
  const desde = Math.min(cap.desde, cap.hasta);
  const hasta = Math.max(cap.desde, cap.hasta);
  return caps.filter((c) => c.n !== null && c.n >= desde && c.n <= hasta);
}

const nombreArchivo = (t) => sinAcentos(t).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'manga';

// ---------------- comando ----------------
module.exports = {
  name: 'manga',
  aliases: ['comic', 'leer'],
  category: 'download',
  description: 'Busca mangas en MangaDex y manda los capítulos en PDF, en español. Uso: .manga <nombre> | <capítulo>',
  execute: async (sock, jid, msg, { texto, prefix = '.' } = {}) => {
    const estilo = porCategoria('download');
    const { titulo: query, cap: capTexto, conCap } = interpretar(texto);

    if (!query) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Dime qué manga buscar.\n\n▸ Ver capítulos: ${prefix}manga one piece\n▸ Leer uno: ${prefix}manga one piece | 1\n▸ Varios (máx. ${MAX_RANGO}): ${prefix}manga one piece | 1-3`,
          { titulo: 'MANGA', estilo }
        )
      }, { quoted: msg });
    }

    let pedidoCap = null;
    if (conCap) {
      pedidoCap = interpretarCap(capTexto);
      if (!pedidoCap) {
        return sock.sendMessage(jid, {
          text: advertencia(`No entendí el capítulo "${capTexto}".\nEj: ${prefix}manga ${query} | 5   o   ${prefix}manga ${query} | 5-7`, { titulo: 'MANGA', estilo })
        }, { quoted: msg });
      }
    }

    if (ocupados.has(jid)) {
      return sock.sendMessage(jid, {
        text: advertencia('Ya estoy preparando un manga en este chat. Espera a que termine.', { titulo: 'MANGA', estilo })
      }, { quoted: msg });
    }
    ocupados.add(jid);

    try {
      await sock.sendMessage(jid, { text: cargando(`Buscando "${query}" en MangaDex...`, { titulo: 'MANGA', estilo }) }, { quoted: msg });

      const resultados = await buscarMangas(query);
      if (!resultados.length) {
        return sock.sendMessage(jid, {
          text: cajaError(`No encontré "${query}" en MangaDex.\nPrueba con el nombre en inglés o romaji, o pega el enlace del manga.`, { titulo: 'MANGA', estilo })
        }, { quoted: msg });
      }

      const { manga, caps, saltados } = await elegirManga(resultados);
      if (!manga) {
        console.log(`[manga] "${query}": ` + saltados.map((x) => `${x.manga.id} (${tituloDe(x.manga)}) externos=${x.externos}`).join(' | '));
        const lineas = [`Encontré "${query}" en MangaDex, pero ninguno tiene capítulos en español que se puedan descargar:`, ''];
        saltados.slice(0, 3).forEach((x) => {
          lineas.push(`▸ *${tituloDe(x.manga)}*: ${x.externos ? `${x.externos} capítulos en español, pero en enlaces externos` : 'sin capítulos en español'}`);
          lineas.push(`   https://mangadex.org/title/${x.manga.id}`);
        });
        if (saltados.some((x) => x.externos)) {
          lineas.push('', 'Los que están en enlaces externos (ej. MANGA Plus) se leen en esa otra página; MangaDex no los guarda, por eso no los puedo convertir a PDF.');
        }
        return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MANGA', estilo }) }, { quoted: msg });
      }
      const titulo = tituloDe(manga);
      const nota = saltados.length ? `ℹ️ *${tituloDe(saltados[0].manga)}* no tiene capítulos en español descargables; uso el siguiente resultado.` : '';

      // ---------- ficha ----------
      if (!conCap) {
        const a = manga.attributes || {};
        const generos = (a.tags || [])
          .filter((t) => t.attributes && t.attributes.group === 'genre')
          .map((t) => t.attributes.name.es || t.attributes.name.en)
          .filter(Boolean).slice(0, 5);
        const estado = ESTADOS[a.status] || a.status || 'Desconocido';
        const sinopsis = sinopsisDe(manga);

        const portada = portadaDe(manga);
        if (portada) {
          try {
            const imagen = await pedir(portada, { tipo: 'buffer', timeout: TIMEOUT_IMG, reintentos: 1 });
            await sock.sendMessage(jid, { image: imagen, caption: `📚 *${titulo}*` }, { quoted: msg });
          } catch (_) { /* sin portada, igual se manda la ficha */ }
        }

        const lineas = [];
        if (nota) lineas.push(nota, '');
        lineas.push(`📚 *${titulo}*`, `📌 ${estado}${a.year ? ` · ${a.year}` : ''}`);
        if (generos.length) lineas.push(`🏷️ ${generos.join(', ')}`);
        if (sinopsis) lineas.push('', `📝 ${sinopsis}`);
        lineas.push('', `📖 Capítulos en español: *${caps.length}*`, `🔢 ${resumirCapitulos(caps)}`);
        const otros = resultados.filter((r) => r.id !== manga.id).slice(0, 4);
        if (otros.length) {
          lineas.push('', '🔎 Otros resultados:');
          otros.forEach((r) => lineas.push(`▸ ${tituloDe(r)}`));
          lineas.push(`(si buscabas otro, escribe su nombre completo)`);
        }
        lineas.push('', `▸ Leer: *${prefix}manga ${titulo} | <capítulo>*`, `▸ Varios: ${prefix}manga ${titulo} | 1-3 (máx. ${MAX_RANGO})`);

        return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MANGA', estilo }) }, { quoted: msg });
      }

      // ---------- capítulos en PDF ----------
      const elegidos = seleccionar(caps, pedidoCap);
      if (!elegidos.length) {
        return sock.sendMessage(jid, {
          text: advertencia(`*${titulo}* no tiene ese capítulo en español.\n\n🔢 Disponibles: ${resumirCapitulos(caps)}`, { titulo: 'MANGA', estilo })
        }, { quoted: msg });
      }
      const lote = elegidos.slice(0, MAX_RANGO);
      const aviso = elegidos.length > lote.length ? `\n(solo mando ${MAX_RANGO} a la vez)` : '';

      await sock.sendMessage(jid, {
        text: cargando(
          `${nota ? nota + '\n' : ''}*${titulo}*\nPreparando ${lote.length > 1 ? `capítulos ${lote[0].etiqueta} al ${lote[lote.length - 1].etiqueta}` : `capítulo ${lote[0].etiqueta}`}...\nEsto puede tardar un poco.${aviso}`,
          { titulo: 'MANGA', estilo }
        )
      }, { quoted: msg });

      for (let i = 0; i < lote.length; i++) {
        const cap = lote[i];
        try {
          const { buffer, paginas } = await generarPdf(cap, titulo);
          if (buffer.length > MAX_PDF_BYTES) {
            await sock.sendMessage(jid, { text: cajaError(`El capítulo ${cap.etiqueta} pesa demasiado para WhatsApp.`, { titulo: 'MANGA', estilo }) }, { quoted: msg });
            continue;
          }
          const nombreCap = cap.clave === 'oneshot' ? 'Oneshot' : `Cap ${cap.etiqueta}`;
          const tituloCap = cap.opciones[0].titulo;
          await sock.sendMessage(jid, {
            document: buffer,
            mimetype: 'application/pdf',
            fileName: `${nombreArchivo(titulo)} - ${nombreArchivo(nombreCap)}.pdf`,
            caption: `📖 *${titulo}*\n${cap.clave === 'oneshot' ? 'Oneshot' : `Capítulo ${cap.etiqueta}`}${tituloCap ? ` - ${tituloCap}` : ''}\n📄 ${paginas} páginas`
          }, { quoted: msg });
        } catch (e) {
          console.error(`[manga] capítulo ${cap.etiqueta} de "${titulo}":`, e);
          await sock.sendMessage(jid, {
            text: cajaError(`No pude armar el capítulo ${cap.etiqueta}: ${e.message}`, { titulo: 'MANGA', estilo })
          }, { quoted: msg });
        }
        if (i < lote.length - 1) await esperar(1500);
      }
    } catch (err) {
      console.error('[manga]', err);
      await sock.sendMessage(jid, {
        text: cajaError(`No pude hablar con MangaDex: ${err.message}`, { titulo: 'MANGA', estilo })
      }, { quoted: msg });
    } finally {
      ocupados.delete(jid);
    }
  }
};

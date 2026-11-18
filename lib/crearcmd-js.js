// lib/crearcmd-js.js
//
// Ayudas para que .crearcmd reciba archivos .js (comandos de otros bots) y para que use como
// REFERENCIA comandos que ya existen en este bot ("es un juego igual que el flappy, usalo de modelo").
//
//   extraerJs(msg, argumentos)  -> el .js adjunto (o citado) + lo que escribio el owner junto al comando
//   analizarCodigo(codigo)      -> estilo del codigo, dependencias (cuales NO estan instaladas aqui)...
//   buscarReferencias(...)      -> comandos del bot que el owner menciono como modelo (+ su codigo)
//
// No importa lib/arcade-crear ni lib/crearcmd-plan (ellos se importan entre si y esto evita ciclos).
'use strict';

const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const RAIZ = path.join(__dirname, '..');
const MAX_BYTES = 150 * 1024;             // un comando (o un archivo con varios) no pesa mas que esto
const MAX_CODIGO_PROMPT = 40000;          // lo que se le manda a la IA del archivo original
const MAX_REFERENCIA = 7000;              // por cada comando de referencia
const MAX_REFERENCIAS = 3;
const MAX_REFERENCIAS_TOTAL = 16000;

const NOTA_ARCADE = 'NOTA: este comando es un juego WEB del ARCADE. El bot manda un .html y la persona juega en el navegador; al perder le da un boleto (ej. FOX-...) que canjea con .reclamar para cobrar monedas del saldo. Si el archivo del owner es un juego por CHAT (el bot pregunta y la gente contesta en el grupo), NO se convierte en juego web: se adapta como comando normal (con lib/juegos.js) y usa de este solo la idea de premio/ranking/estilo.';

// ───────────── Detectar el .js en el mensaje ─────────────
function documentoDe(msg) {
  const m = (msg && msg.message) || {};
  const dentro = (x) => x && (x.documentMessage || (x.documentWithCaptionMessage && x.documentWithCaptionMessage.message && x.documentWithCaptionMessage.message.documentMessage));
  const propio = dentro(m);
  if (propio) return propio;
  const ctx = (m.extendedTextMessage && m.extendedTextMessage.contextInfo) || null;
  return ctx && ctx.quotedMessage ? dentro(ctx.quotedMessage) : null;
}

const esDocJs = (doc) => !!doc && (/\.(c|m)?js$/i.test(doc.fileName || '') || /javascript/i.test(doc.mimetype || ''));

// Devuelve { archivo: { nombre, codigo }, instrucciones, analisis } | { error } | null (no hay ningun .js)
async function extraerJs(msg, argumentos) {
  const doc = documentoDe(msg);
  if (!esDocJs(doc)) return null;
  const kb = (n) => Math.round(n / 1024);
  const demasiado = (n) => ({ error: `El archivo pesa ${kb(n)} KB y el maximo es ${kb(MAX_BYTES)} KB. Mandame un comando por archivo (o recorta lo que no necesites).` });
  if (Number(doc.fileLength || 0) > MAX_BYTES) return demasiado(Number(doc.fileLength));

  let buf;
  try {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
    buf = await downloadMediaMessage({ message: { documentMessage: doc } }, 'buffer', {});
  } catch (err) {
    console.error('[crearcmd-js] no pude descargar el adjunto:', err.message);
    return { error: 'No pude descargar el archivo adjunto. Mandalo de nuevo como documento.' };
  }
  if (!buf || !buf.length) return { error: 'El archivo llego vacio o no se pudo descargar. Mandalo de nuevo como documento.' };
  if (buf.length > MAX_BYTES) return demasiado(buf.length);

  const crudo = buf.toString('utf8').replace(/^\uFEFF/, '');
  if (!crudo.trim()) return { error: 'El archivo llego vacio.' };
  const { codigo, cantidad } = ocultarClaves(crudo);
  const nombre = String(doc.fileName || 'comando.js').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
  const analisis = analizarCodigo(codigo);
  analisis.clavesOcultas = cantidad;
  return { archivo: { nombre, codigo }, instrucciones: String(argumentos || '').trim(), analisis };
}

// ───────────── Claves escritas dentro del codigo ─────────────
// Los comandos de otros bots suelen traer su API key escrita en el codigo. Aqui NO se manda a la IA ni se deja en el comando
// nuevo (el repo del bot puede ser publico): se cambia por <CLAVE_1>, <CLAVE_2>... y el comando nuevo debe leerla con getApiKey().
const PATRONES_CLAVE = [
  /\bAIza[0-9A-Za-z_-]{30,}/g, /\bsk-[A-Za-z0-9_-]{20,}/g, /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bghp_[A-Za-z0-9]{30,}/g, /\bxox[bp]-[A-Za-z0-9-]{20,}/g, /\bnvapi-[A-Za-z0-9_-]{20,}/g
];
const RE_ASIGNA = /((?:api[_-]?key|apikey|token|secret|password|passwd|authorization|bearer)['"`]?\s*[:=]\s*['"`])([^'"`\s]{12,})(['"`])/gi;
const RE_QUERY = /([?&](?:api[_-]?key|apikey|key|token|access_token)=)([A-Za-z0-9_.-]{12,})/gi;
const esPlaceholder = (v) => /^(x{4,}|\.{3}|<.*>|your|tu[_-]|ejemplo|example|changeme)/i.test(v) || /\$\{/.test(v) || /^https?:/i.test(v) || /^process\.env/.test(v);

function ocultarClaves(codigo) {
  let n = 0;
  const marca = () => `<CLAVE_${++n}>`;
  let out = String(codigo);
  for (const re of PATRONES_CLAVE) out = out.replace(re, marca);
  out = out.replace(RE_ASIGNA, (m, antes, valor, cierre) => (esPlaceholder(valor) ? m : antes + marca() + cierre));
  out = out.replace(RE_QUERY, (m, antes, valor) => (esPlaceholder(valor) ? m : antes + marca()));
  return { codigo: out, cantidad: n };
}

// ───────────── Analizar el codigo (sin ejecutarlo) ─────────────
function modulosDe(codigo) {
  const set = new Set();
  for (const m of codigo.matchAll(/require\(\s*['"`]([^'"`\n]+)['"`]\s*\)/g)) set.add(m[1]);
  for (const m of codigo.matchAll(/(?:^|[\s;])import\s+(?:[\w*${},\s]+\s+from\s+)?['"]([^'"\n]+)['"]/gm)) set.add(m[1]);
  for (const m of codigo.matchAll(/import\(\s*['"]([^'"\n]+)['"]\s*\)/g)) set.add(m[1]);
  return [...set].slice(0, 40);
}

// 'node' | 'instalado' | 'local' (archivo propio del otro bot) | 'falta' (paquete que NO esta instalado aqui)
function clasificarModulo(nombre) {
  if (/^[./]/.test(nombre)) return 'local';
  const limpio = nombre.replace(/^node:/, '');
  const partes = limpio.split('/');
  const paquete = limpio.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0];
  if (builtinModules.includes(limpio) || builtinModules.includes(partes[0])) return 'node';
  try {
    if (fs.existsSync(path.join(RAIZ, 'node_modules', paquete, 'package.json'))) return 'instalado';
  } catch (_) { /* se cuenta como que falta */ }
  return 'falta';
}

function detectarTipo(c) {
  const navegador = /\b(document\.(getElementById|querySelector|createElement|body)|window\.(addEventListener|innerWidth|requestAnimationFrame)|requestAnimationFrame\(|getContext\(\s*['"]2d['"]\s*\))/.test(c);
  const botApi = /\b(module\.exports|export\s+default|sock\.|conn\.|client\.|m\.reply|handler\.|sendMessage\s*\()/.test(c);
  if (navegador && !botApi) return { tipo: 'navegador', descripcion: 'codigo de navegador (usa document/canvas), no un comando de bot' };
  if (/\bhandler\.(command|help|tags|run)\b|\bm\.reply\b|\bconn\.sendMessage\(\s*m\.chat/.test(c)) return { tipo: 'handler', descripcion: 'estilo "handler" de otros bots (handler.command, m.reply, conn...)' };
  const cases = (c.match(/\bcase\s+['"`][\w-]+['"`]\s*:/g) || []).length;
  if (cases >= 2) return { tipo: 'switch', descripcion: `varios comandos dentro de un switch/case (${cases} "case")` };
  if (/module\.exports\s*=/.test(c) && /\bexecute\b/.test(c)) return { tipo: 'este-bot', descripcion: 'ya parece un comando de este estilo (module.exports + execute)' };
  if (/export\s+default|^\s*import\s/m.test(c)) return { tipo: 'esm', descripcion: 'modulo ES (import/export), hay que pasarlo a CommonJS' };
  return { tipo: 'desconocido', descripcion: 'no pude reconocer el estilo del codigo' };
}

function analizarCodigo(codigo) {
  const { tipo, descripcion } = detectarTipo(codigo);
  const modulos = modulosDe(codigo).map((nombre) => ({ nombre, estado: clasificarModulo(nombre) }));
  return {
    tipo, descripcion, modulos,
    lineas: codigo.split('\n').length,
    caracteres: codigo.length,
    truncado: codigo.length > MAX_CODIGO_PROMPT
  };
}

// Texto corto (para la IA y para el owner) con lo que se detecto en el archivo
function resumenAnalisis(a) {
  const l = [`Estilo detectado: ${a.descripcion}.`, `Tamano: ${a.lineas} lineas.`];
  if (a.modulos.length) {
    const etiqueta = { node: 'viene con Node', instalado: 'instalado en este bot', local: 'archivo propio del otro bot, NO existe aqui', falta: 'NO esta instalado aqui' };
    l.push('Dependencias: ' + a.modulos.map((m) => `${m.nombre} (${etiqueta[m.estado]})`).join(', ') + '.');
  } else {
    l.push('Dependencias: ninguna.');
  }
  const faltan = a.modulos.filter((m) => m.estado === 'falta' || m.estado === 'local');
  if (faltan.length) l.push(`OJO: no se pueden usar ${faltan.map((m) => m.nombre).join(', ')}; hay que reemplazarlos con fetch/Node o quitar esa parte.`);
  if (a.clavesOcultas) {
    l.push(`CLAVES: el archivo traia ${a.clavesOcultas} clave(s)/token(s) escritas en el codigo; el bot las cambio por <CLAVE_1>, <CLAVE_2>... antes de mandartelo. En el comando NUEVO no escribas ninguna clave: usa const { getApiKey } = require('../../lib/apikeys'); getApiKey('<servicio>') y deja un comentario al inicio diciendo que el owner la guarda con .setapikey <servicio> <clave> forzar.`);
  }
  if (a.truncado) l.push(`El archivo es largo: a la IA solo le llegan los primeros ${MAX_CODIGO_PROMPT} caracteres.`);
  return l.join('\n');
}

const recortarCodigo = (codigo) => (codigo.length > MAX_CODIGO_PROMPT ? codigo.slice(0, MAX_CODIGO_PROMPT) + '\n// ... (archivo recortado)' : codigo);

// ───────────── Referencias: comandos del bot que el owner menciona como modelo ─────────────
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CUE = '(?:como|igual(?:\\s+que|\\s+a)?|identico\\s+a|parecid[oa]\\s+a|similar\\s+a|referencia|ejemplo|basate\\s+en|basad[oa]\\s+en|modelo|estilo(?:\\s+de)?)';
const ARTICULOS = '(?:(?:el|la|los|las|al|del|de|un|una|tu|su|que)\\s+){0,2}';

function nombresMencionados(texto, prefix) {
  const t = sinAcentos(texto);
  const p = escapar(sinAcentos(prefix || '.'));
  const nombres = new Set();
  // 1) con prefijo: ".flappy"
  for (const m of t.matchAll(new RegExp(`(?:^|[\\s("'])${p}([a-z0-9_-]{2,})`, 'g'))) nombres.add(m[1]);
  // 2) tras una palabra de referencia: "igual que el flappy", "como el juego ahorcado", "de ejemplo el trivia"
  for (const m of t.matchAll(new RegExp(`\\b${CUE}\\s+${ARTICULOS}(?:(?:comando|juego|cmd)\\s+)?(?:de\\s+)?(?:${p})?([a-z0-9_-]{3,})`, 'g'))) nombres.add(m[1]);
  return [...nombres];
}

function leerReferencia(nombre, cmd) {
  const ruta = cmd && cmd._rutaArchivo;
  if (!ruta) return null;
  try {
    const rel = path.relative(RAIZ, ruta).split(path.sep).join('/');
    let codigo = fs.readFileSync(ruta, 'utf8');
    const truncado = codigo.length > MAX_REFERENCIA;
    if (truncado) codigo = codigo.slice(0, MAX_REFERENCIA) + '\n// ... (recortado)';
    return {
      nombre, categoria: cmd.category || '', archivo: rel, codigo, truncado,
      nota: /^commands\/arcade\//.test(rel) ? NOTA_ARCADE : ''
    };
  } catch (_) { return null; }
}

// texto: lo que escribio el owner. comandos: el Map en vivo del bot. Devuelve [{ nombre, categoria, archivo, codigo, nota }]
function buscarReferencias(texto, comandos, prefix, yaTiene = []) {
  if (!comandos || !texto) return [];
  const vistos = new Set(yaTiene.map((r) => r.archivo + '|' + r.nombre));
  const archivosVistos = new Set(yaTiene.map((r) => r.archivo));
  const salida = [];
  for (const n of nombresMencionados(texto, prefix)) {
    if (salida.length + yaTiene.length >= MAX_REFERENCIAS) break;
    const cmd = comandos.get(n);
    // Los comandos de owner no se mandan a la IA como ejemplo (suelen tocar archivos/ajustes del bot)
    if (!cmd || cmd.category === 'owner') continue;
    const ref = leerReferencia(cmd.name || n, cmd);
    if (!ref || vistos.has(ref.archivo + '|' + ref.nombre)) continue;
    // Si dos nombres (o un nombre y su alias) apuntan al mismo archivo, se manda una sola vez
    if (archivosVistos.has(ref.archivo)) continue;
    archivosVistos.add(ref.archivo);
    vistos.add(ref.archivo + '|' + ref.nombre);
    salida.push(ref);
  }
  return salida;
}

// Bloque de texto para los prompts de la IA ('' si no hay referencias)
function textoReferencias(refs) {
  if (!refs || !refs.length) return '';
  let total = 0;
  const bloques = [];
  for (const r of refs) {
    const trozo = r.codigo.slice(0, Math.max(0, MAX_REFERENCIAS_TOTAL - total));
    if (!trozo) break;
    total += trozo.length;
    bloques.push(`--- referencia: .${r.nombre} (archivo ${r.archivo}${r.categoria ? ', categoria ' + r.categoria : ''}) ---\n${r.nota ? r.nota + '\n' : ''}"""\n${trozo}\n"""`);
  }
  return `\n\nREFERENCIAS QUE PIDIO EL OWNER (comandos que YA existen en este bot y quiere usar de modelo). Imita su estructura, sus helpers y su estilo; NO los copies tal cual y NO reutilices sus nombres ni alias:\n${bloques.join('\n\n')}`;
}

// Linea corta para el owner ("Uso de referencia: .flappy")
function listaReferencias(refs, prefix) {
  return (refs || []).map((r) => `${prefix}${r.nombre}`).join(', ');
}

module.exports = {
  extraerJs, documentoDe, esDocJs, analizarCodigo, resumenAnalisis, recortarCodigo,
  buscarReferencias, textoReferencias, listaReferencias, nombresMencionados, clasificarModulo, ocultarClaves,
  MAX_BYTES, MAX_CODIGO_PROMPT
};

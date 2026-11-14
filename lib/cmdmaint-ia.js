// Entiende las instrucciones en español que el owner le da a .repararcmd ("elimina los duplicados de anime", "mueve .pat a fun"...).
//
// Primero reglas (rapido, gratis y predecible); solo si no entiende nada se le pregunta a la IA, y la IA solo puede escoger una
// ACCION de la lista de abajo con sus datos: nunca escribe ni ejecuta codigo. Lo que modifica archivos es codigo fijo (lib/cmdmaint.js).
const { resolverCategoria, listarCategorias } = require('./categorias');

const ACCIONES = ['ayuda', 'salud', 'duplicados', 'eliminar_duplicados', 'listar', 'info', 'buscar', 'mover', 'eliminar', 'reparar', 'probar', 'respaldos', 'restaurar'];

const norm = (t) => String(t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9ñ.\-_/\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const RE_NOMBRE_VALIDO = /^[a-z0-9_-]{1,40}$/;
const PALABRAS_SUELTAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'a', 'al', 'en', 'con', 'que', 'y', 'o', 'un', 'una', 'por', 'favor', 'porfa', 'todos', 'todas', 'todo', 'cmd', 'comando', 'comandos', 'categoria', 'categorias', 'carpeta', 'archivo', 'me', 'mi', 'su', 'se', 'lo', 'es', 'son', 'hay', 'ya', 'solo', 'sola', 'solamente', 'esos', 'esas', 'este', 'esta', 'estos', 'estas', 'pls', 'oye', 'hola', 'necesito', 'quiero', 'ahora', 'bot']);

const RE_QUITAR = /\b(elimin\w*|borr\w*|quit\w*|limpi\w*|remuev\w*|remover|sac\w+|depur\w*|descart\w*|deshaz\w*|desaz\w*|destru\w*|fuera)\b/;
const RE_DUP = /\b(duplic\w*|repetid\w*|repetic\w*|dobles?|doblad\w*|choc\w*|pisa\w*|encim\w*|iguales)\b/;
const RE_CONSERVAR = /\b(conserv\w*|queda\w*|dej\w*|prefier\w*|mant\w*|respet\w*)\b/;

function categoriasEn(texto) {
  const hallazgos = [];
  for (const palabra of norm(texto).split(' ')) {
    const p = palabra.replace(/^[./]+|[./]+$/g, '');
    if (!p || p.length < 2) continue;
    const c = resolverCategoria(p);
    if (c && !hallazgos.includes(c)) hallazgos.push(c);
  }
  return hallazgos;
}

// .nombre (con cualquier prefijo conocido) o "comando nombre"
function nombresEn(texto, { prefix = '.', existe = null } = {}) {
  const n = norm(texto);
  const res = [];
  const poner = (x) => { const v = String(x || '').replace(/^[^a-z0-9]+/, '').replace(/\.js$/, ''); if (RE_NOMBRE_VALIDO.test(v) && !res.includes(v)) res.push(v); };
  for (const m of n.matchAll(/(?:^|\s)[.!#/]([a-z0-9_-]{1,40})(?=\s|$)/g)) poner(m[1]);
  if (prefix && prefix.length === 1 && prefix !== '.') {
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const m of String(texto || '').toLowerCase().matchAll(new RegExp(`(?:^|\\s)${esc}([a-z0-9_-]{1,40})(?=\\s|$)`, 'g'))) poner(m[1]);
  }
  for (const m of n.matchAll(/\b(?:comando|cmd)\s+([a-z0-9_-]{1,40})\b/g)) if (!['de', 'la', 'el', 'los', 'las', 'que', 'duplicado', 'duplicados'].includes(m[1])) poner(m[1]);
  // palabra suelta que sea un comando que SI existe (solo si no hubo ninguno explicito)
  if (!res.length && typeof existe === 'function') {
    for (const p of n.split(' ')) {
      if (PALABRAS_SUELTAS.has(p) || p.length < 2) continue;
      if (existe(p) && !resolverCategoria(p)) { poner(p); }
    }
  }
  return res;
}

function archivosEn(texto) {
  return [...norm(texto).matchAll(/(?:^|\s)((?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.js)(?=\s|$)/g)].map((m) => m[1]);
}

// "conserva los de anime" / "quedate con lo de fun/x.js" -> { categoria } | { archivo }
function parseConservar(texto) {
  const archivos = archivosEn(texto);
  if (archivos.length) return { archivo: archivos[0].includes('/') ? archivos[0] : archivos[0] };
  const cats = categoriasEn(texto);
  return cats.length ? { categoria: cats[0] } : null;
}

function interpretarReglas(texto, { prefix = '.', existe = null } = {}) {
  const n = norm(texto);
  const base = { origen: 'reglas', texto: n };
  if (!n || /^(ayuda|help|ayudame|menu|opciones|ejemplos|que puedes( hacer)?|que sabes( hacer)?|como (te )?uso|como funcionas?)$/.test(n)) return { ...base, accion: 'ayuda' };

  const cats = categoriasEn(texto);
  const nombres = nombresEn(texto, { prefix, existe });
  const quitar = RE_QUITAR.test(n);
  const dup = RE_DUP.test(n);
  const ts = (/\b(\d{8}-\d{6}(?:-\d{2})?)\b/.exec(n) || [])[1] || null;

  // deshacer / respaldos
  if (/\b(respaldos?|backups?)\b/.test(n) && /\b(lista\w*|muestra\w*|ver|cuales|hay|enseña\w*|ensena\w*|que)\b/.test(n) && !/\b(restaur\w*|deshac\w*|revert\w*|regres\w*)\b/.test(n)) return { ...base, accion: 'respaldos' };
  if (/\b(deshac\w*|deshaz\w*|undo|revert\w*|restaur\w*|regres\w*|recuper\w*|vuelve\w* atras|vuelvelo|como estaba\w*|echa\w* para atras|atras)\b/.test(n) && !/\bdeshaz\w* de\b/.test(n)) return { ...base, accion: 'restaurar', ts };
  if (/\b(respaldos?|backups?)\b/.test(n)) return { ...base, accion: 'respaldos' };

  // duplicados
  if (dup || (/\b(limpi\w*|depur\w*|ordena\w*)\b/.test(n) && (cats.length || /\b(todo|todos|todas)\b/.test(n)) && !nombres.length)) {
    const corte = RE_CONSERVAR.exec(n);
    const antes = corte ? n.slice(0, corte.index) : n;
    const despues = corte ? n.slice(corte.index + corte[0].length) : '';
    const conservar = corte ? parseConservar(despues) : null;
    const categoria = categoriasEn(antes)[0] || (corte ? null : (cats[0] || null));
    const accion = (quitar || /\b(limpi\w*|depur\w*|ordena\w*)\b/.test(n)) ? 'eliminar_duplicados' : 'duplicados';
    return { ...base, accion, categoria, conservar };
  }

  // mover
  if (/\b(mueve\w*|mover|pasa\w*|cambia\w*|manda\w*|traslada\w*|reubica\w*)\b/.test(n) && nombres.length && cats.length) {
    return { ...base, accion: 'mover', nombre: nombres[0], destino: cats[cats.length - 1] };
  }

  // eliminar un comando concreto
  if (quitar && nombres.length) return { ...base, accion: 'eliminar', nombre: nombres[0] };

  // info / buscar / listar
  if (/\b(info\w*|detalle\w*|donde (esta|vive)|en que (archivo|categoria)|que hace|dime (de|sobre)|sobre|datos)\b/.test(n) && nombres.length) return { ...base, accion: 'info', nombre: nombres[0] };
  const busca = /\b(busca\w*|encuentra\w*|existe\w*|hay (algun|un)\w*|localiza\w*)\b/.exec(n);
  if (busca) {
    const resto = n.slice(busca.index + busca[0].length).split(' ').filter((p) => p && !PALABRAS_SUELTAS.has(p) && !/^(algun|alguno|alguna)$/.test(p));
    if (resto.length) return { ...base, accion: 'buscar', consulta: resto.join(' ').replace(/^[.!#/]/, '') };
  }
  if (/\b(lista\w*|muestra\w*|ensena\w*|enlista\w*|cuales|que comandos|ver (los )?comandos|dime los)\b/.test(n)) {
    return cats.length ? { ...base, accion: 'listar', categoria: cats[0] } : { ...base, accion: 'salud' };
  }

  // salud general
  if (/\b(salud|estado|resumen|diagnostic\w*|reporte|auditor\w*|como (esta|andan|van)|todo bien|escanea\w*|panorama)\b/.test(n) && !cats.length) return { ...base, accion: 'salud' };

  // probar / reparar una categoria (lo de siempre)
  if (cats.length) {
    if (/\b(prueba\w*|probar|testea\w*|checa\w*|verifica\w*|revisa\w*|funcionan?)\b/.test(n) && !/\b(repar\w*|arregl\w*)\b/.test(n)) return { ...base, accion: 'probar', categoria: cats[0] };
    return { ...base, accion: 'reparar', categoria: cats[0] };
  }
  if (/\b(salud|estado|resumen|diagnostic\w*|reporte)\b/.test(n)) return { ...base, accion: 'salud' };

  return { ...base, accion: 'no_entendi' };
}

// ---------------------------------------------------------------- IA (solo si las reglas no entendieron)
function promptInterprete(texto, prefix) {
  return `Eres el interprete de instrucciones de un panel de mantenimiento de comandos de un bot de WhatsApp. El owner escribe una orden en español y tu la conviertes a UNA accion de esta lista (nada mas):

- ayuda: no pidio nada concreto / quiere saber que puedes hacer.
- salud: resumen general de los comandos (cuantos hay, rotos, duplicados).
- duplicados {categoria?}: SOLO MOSTRAR cuales comandos/alias estan repetidos (sin borrar nada).
- eliminar_duplicados {categoria?, conservar?}: quitar los repetidos. "conservar" = { "categoria": "x" } o { "archivo": "carpeta/archivo.js" } si pidio quedarse con la version de algun lugar.
- listar {categoria}: mostrar los comandos de una categoria.
- info {nombre}: datos de un comando (en que archivo esta, alias, si esta repetido).
- buscar {consulta}: buscar comandos por nombre/alias/descripcion.
- mover {nombre, destino}: pasar un comando a otra categoria.
- eliminar {nombre}: quitar un comando concreto.
- reparar {categoria}: probar los comandos de una categoria y arreglar con IA los que fallan.
- probar {categoria}: solo probar los comandos de una categoria, sin arreglar.
- respaldos: listar los respaldos de limpiezas anteriores.
- restaurar {ts?}: deshacer la ultima limpieza (o la del respaldo ts).

Categorias que existen: ${listarCategorias().join(', ')}.
Los nombres de comando van sin prefijo (el prefijo es "${prefix}") y en minusculas.

Orden del owner: """${String(texto).slice(0, 600)}"""

Responde SOLO con un JSON en una linea, sin texto extra ni markdown. Ejemplo: {"accion":"duplicados","categoria":"anime"}
Si no se puede saber que quiere: {"accion":"no_entendi"}`;
}

function validarDeIA(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const accion = String(obj.accion || '').toLowerCase();
  if (accion === 'no_entendi') return { accion: 'no_entendi', origen: 'ia' };
  if (!ACCIONES.includes(accion)) return null;
  const r = { accion, origen: 'ia' };
  const cat = (v) => (v ? resolverCategoria(String(v)) : null);
  const nombre = (v) => { const x = String(v || '').toLowerCase().trim().replace(/^[.!#]/, ''); return RE_NOMBRE_VALIDO.test(x) ? x : null; };
  if (obj.categoria !== undefined && obj.categoria !== null && obj.categoria !== '') {
    r.categoria = cat(obj.categoria);
    if (!r.categoria) return null; // categoria inventada
  }
  if (['listar', 'reparar', 'probar'].includes(accion) && !r.categoria) return null;
  if (['info', 'mover', 'eliminar'].includes(accion)) { r.nombre = nombre(obj.nombre); if (!r.nombre) return null; }
  if (accion === 'mover') { r.destino = cat(obj.destino); if (!r.destino) return null; }
  if (accion === 'buscar') { r.consulta = String(obj.consulta || '').trim().slice(0, 60); if (!r.consulta) return null; }
  if (accion === 'eliminar_duplicados' && obj.conservar && typeof obj.conservar === 'object') {
    if (obj.conservar.categoria && cat(obj.conservar.categoria)) r.conservar = { categoria: cat(obj.conservar.categoria) };
    else if (typeof obj.conservar.archivo === 'string' && /^[a-z0-9_/-]+\.js$/i.test(obj.conservar.archivo)) r.conservar = { archivo: obj.conservar.archivo };
  }
  if (accion === 'restaurar' && typeof obj.ts === 'string' && /^\d{8}-\d{6}(?:-\d{2})?$/.test(obj.ts)) r.ts = obj.ts;
  return r;
}

function extraerJson(texto) {
  const t = String(texto || '').replace(/```[a-z]*/gi, '');
  const m = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/.exec(t);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

async function interpretar(texto, ctx = {}) {
  const porReglas = interpretarReglas(texto, ctx);
  if (porReglas.accion !== 'no_entendi') return porReglas;
  if (norm(texto).length < 4) return porReglas;
  try {
    const { generarTexto } = require('./gemini');
    const bruto = await generarTexto(promptInterprete(texto, ctx.prefix || '.'), { maxTokens: 600, timeoutMs: 25000, temperatura: 0 });
    const valida = validarDeIA(extraerJson(bruto));
    if (valida) return { ...valida, texto: norm(texto) };
  } catch (err) {
    return { ...porReglas, errorIA: String((err && err.message) || err).slice(0, 160) };
  }
  return porReglas;
}

function textoAyuda(prefix = '.') {
  return [
    'Dime lo que necesitas, como si hablaras conmigo:',
    '',
    `🔁 ${prefix}repararcmd muestrame los duplicados`,
    `🔁 ${prefix}repararcmd duplicados de anime`,
    `🧹 ${prefix}repararcmd elimina todos los duplicados`,
    `🧹 ${prefix}repararcmd limpia los duplicados de anime y conserva los de fun`,
    `📋 ${prefix}repararcmd lista los comandos de anime`,
    `🔎 ${prefix}repararcmd busca hentai · info de ${prefix}pat`,
    `📦 ${prefix}repararcmd mueve ${prefix}pat a fun · elimina ${prefix}pat`,
    `🩺 ${prefix}repararcmd como esta todo (resumen de salud)`,
    `🛠️ ${prefix}repararcmd repara anime (prueba y arregla con IA)`,
    `🧪 ${prefix}repararcmd prueba logos (solo prueba)`,
    `↩️ ${prefix}repararcmd deshaz lo ultimo · respaldos`,
    '',
    'Antes de borrar o mover algo te muestro el plan y espero tu *si*. Nada se pierde: todo queda en un respaldo que puedes restaurar.'
  ];
}

module.exports = { interpretar, interpretarReglas, validarDeIA, extraerJson, textoAyuda, parseConservar, ACCIONES, norm };

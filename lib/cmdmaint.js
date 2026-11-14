// Motor de mantenimiento de comandos (lo usa .repararcmd): escanea commands/, detecta duplicados, arma un PLAN, lo aplica con
// respaldo y verificacion, y lo deshace. No usa IA: todo lo que modifica archivos es codigo determinista.
//
// Seguridad:
//  - Nada se borra: los archivos se MUEVEN a commands/_eliminados/mantenimiento/<fecha>/ (el cargador ignora las carpetas "_").
//  - Cada archivo editado se respalda ahi antes de tocarlo, se revisa la sintaxis y se vuelve a cargar en un proceso aparte
//    para comprobar que quedaron EXACTAMENTE los comandos esperados; si algo no cuadra se deja como estaba.
//  - Cada operacion guarda un manifest.json para poder restaurarla (.repararcmd restaurar).
//  - Por defecto se conserva el comando que HOY esta activo (el ultimo que carga el bot), asi quitar los repetidos no cambia nada.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);
const RAIZ = path.join(__dirname, '..');
const BASE_COMANDOS = path.join(RAIZ, 'commands');
const CARPETA_RESPALDOS = path.join('_eliminados', 'mantenimiento');
const PROTEGIDOS = new Set(['owner/repararcmd.js']);

const aRel = (base, ruta) => path.relative(base, ruta).split(path.sep).join('/');

// ---------------------------------------------------------------- escaneo (misma logica y orden que el cargador de index.js)
function listarJs(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(listarJs(p));
    else if (e.name.endsWith('.js')) r.push(p);
  }
  return r;
}

function categoriasActivas(base = BASE_COMANDOS) {
  return fs.readdirSync(base).filter((c) => !c.startsWith('_') && fs.statSync(path.join(base, c)).isDirectory());
}

const textos = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

// Si un archivo no carga, se leen sus nombres del TEXTO para no quedar ciegos
function extraerEstatico(texto) {
  const res = [];
  const re = /\bname\s*:\s*(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g;
  const mapa = mapaDeCodigo(texto);
  let m;
  while ((m = re.exec(texto))) {
    if (!mapa[m.index]) continue;
    const lim = limitesDesde(texto, m.index, mapa);
    const trozo = lim ? texto.slice(lim.ini, lim.fin + 1) : '';
    const sacar = (clave) => {
      const mm = new RegExp(`\\b${clave}\\s*:\\s*\\[([^\\]]*)\\]`).exec(trozo);
      return mm ? [...mm[1].matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g)].map((x) => x[2]) : [];
    };
    res.push({ name: m[2], aliases: sacar('aliases'), ocultas: sacar('aliasesOcultas') });
  }
  return res;
}

function escanear(base = BASE_COMANDOS) {
  const entradas = [];
  const rotos = [];
  const sinExecute = [];
  for (const categoria of categoriasActivas(base)) {
    for (const ruta of listarJs(path.join(base, categoria))) {
      const archivo = aRel(base, ruta);
      let lista = null;
      let error = null;
      try {
        const m = require(ruta);
        lista = Array.isArray(m) ? m : [m];
      } catch (err) {
        error = String((err && err.message) || err).split('\n')[0].slice(0, 140);
      }
      if (lista) {
        lista.forEach((c, i) => {
          if (!c || typeof c.name !== 'string' || !c.name) { rotos.push({ archivo, error: 'exporta un comando sin "name" valido' }); return; }
          if (typeof c.execute !== 'function') sinExecute.push({ archivo, name: c.name });
          entradas.push({
            name: c.name, aliases: textos(c.aliases), ocultas: textos(c.aliasesOcultas),
            categoria, archivo, ruta, indice: i, total: lista.length, origen: 'cargado',
            descripcion: String(c.description || '')
          });
        });
      } else {
        rotos.push({ archivo, error });
        let texto = '';
        try { texto = fs.readFileSync(ruta, 'utf-8'); } catch (_) { /* sin texto */ }
        extraerEstatico(texto).forEach((e, i, todos) => {
          entradas.push({ ...e, categoria, archivo, ruta, indice: i, total: todos.length, origen: 'texto', descripcion: '' });
        });
      }
    }
  }
  return { entradas, rotos, sinExecute };
}

// ---------------------------------------------------------------- duplicados
// Cada nombre/alias con todas sus apariciones, en el orden en que carga el bot (la ultima es la que gana hoy)
function apariciones(entradas) {
  const por = new Map();
  const poner = (clave, entrada, via) => { if (!por.has(clave)) por.set(clave, []); por.get(clave).push({ entrada, via }); };
  for (const e of entradas) {
    poner(e.name, e, 'name');
    for (const a of e.aliases) poner(a, e, 'alias');
    for (const a of e.ocultas) poner(a, e, 'oculta');
  }
  return por;
}

// Nombres de archivos ROTOS (leidos del texto) que chocarian con otro comando cuando se arreglen. Solo informativo.
function choquesPosibles(entradas) {
  const res = [];
  for (const [clave, lista] of apariciones(entradas)) {
    if (!lista.some((o) => o.entrada.origen === 'texto')) continue;
    if (new Set(lista.map((o) => idEntrada(o.entrada))).size < 2) continue;
    res.push({ clave, ocurrencias: lista });
  }
  return res;
}

const idEntrada = (e) => `${e.archivo}#${e.indice}`;

// Solo cuentan los archivos que SI cargan: los que estan rotos no registran nada en el bot (ver choquesPosibles)
function detectarDuplicados(entradas, { categoria = null } = {}) {
  const dups = [];
  for (const [clave, lista] of apariciones(entradas.filter((e) => e.origen === 'cargado'))) {
    if (new Set(lista.map((o) => idEntrada(o.entrada))).size < 2) continue;
    if (categoria && !lista.some((o) => o.entrada.categoria === categoria)) continue;
    dups.push({ clave, ocurrencias: lista, ganador: lista[lista.length - 1], cruzaCategorias: new Set(lista.map((o) => o.entrada.categoria)).size > 1 });
  }
  return dups;
}

// ---------------------------------------------------------------- leer codigo JS sin confundirse con strings/comentarios
function mapaDeCodigo(t) {
  const n = t.length;
  const m = new Uint8Array(n);
  let i = 0;
  let prev = '';
  while (i < n) {
    const c = t[i];
    const d = t[i + 1];
    if (c === '/' && d === '/') { while (i < n && t[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '\'' || c === '"') {
      const q = c; i++;
      while (i < n && t[i] !== q) { if (t[i] === '\\') i++; if (t[i] === '\n') break; i++; }
      i++; prev = 'x'; continue;
    }
    if (c === '`') {
      i++; let prof = 0;
      while (i < n) {
        if (t[i] === '\\') { i += 2; continue; }
        if (t[i] === '`' && prof === 0) break;
        if (t[i] === '$' && t[i + 1] === '{') { prof++; i += 2; continue; }
        if (t[i] === '}' && prof > 0) { prof--; i++; continue; }
        i++;
      }
      i++; prev = 'x'; continue;
    }
    if (c === '/' && (prev === '' || '(,=:[!&|?{};'.includes(prev))) {
      i++; let clase = false;
      while (i < n) {
        if (t[i] === '\\') { i += 2; continue; }
        if (t[i] === '[') clase = true; else if (t[i] === ']') clase = false;
        else if (t[i] === '/' && !clase) break; else if (t[i] === '\n') break;
        i++;
      }
      i++; while (i < n && /[a-z]/i.test(t[i])) i++;
      prev = 'x'; continue;
    }
    m[i] = 1;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return m;
}

// Llaves { } que encierran la posicion `pos`
function limitesDesde(texto, pos, mapa = mapaDeCodigo(texto)) {
  let prof = 0;
  let ini = -1;
  for (let i = pos - 1; i >= 0; i--) {
    if (!mapa[i]) continue;
    const c = texto[i];
    if (c === '}') prof++;
    else if (c === '{') { if (prof === 0) { ini = i; break; } prof--; }
  }
  if (ini < 0) return null;
  prof = 0;
  for (let i = ini; i < texto.length; i++) {
    if (!mapa[i]) continue;
    if (texto[i] === '{') prof++;
    else if (texto[i] === '}') { prof--; if (prof === 0) return { ini, fin: i }; }
  }
  return null;
}

// Apariciones de `name: 'x'` (como propiedad, en codigo real) -> posiciones
function posicionesDeNombre(texto, name, mapa = mapaDeCodigo(texto)) {
  const res = [];
  const re = /\bname\s*:\s*(['"`])((?:\\.|(?!\1)[^\\\n])+)\1/g;
  let m;
  while ((m = re.exec(texto))) if (mapa[m.index] && m[2] === name) res.push(m.index);
  return res;
}

// El objeto { name: 'x', ... } ¿es un elemento de un arreglo literal [ {...}, {...} ]? (si no, no se puede quitar solo)
function contenedorEsArreglo(texto, ini, mapa) {
  let prof = 0;
  for (let i = ini - 1; i >= 0; i--) {
    if (!mapa[i]) continue;
    const c = texto[i];
    if (c === ')' || c === ']' || c === '}') prof++;
    else if (c === '(' || c === '[' || c === '{') { if (prof === 0) return c === '['; prof--; }
  }
  return false;
}

function quitarEntradaDeTexto(texto, name, nth = 0) {
  const mapa = mapaDeCodigo(texto);
  const pos = posicionesDeNombre(texto, name, mapa)[nth];
  if (pos === undefined) return { ok: false, motivo: `no encontre "name: '${name}'" en el codigo` };
  const lim = limitesDesde(texto, pos, mapa);
  if (!lim) return { ok: false, motivo: 'no pude ubicar el objeto del comando' };
  if (!contenedorEsArreglo(texto, lim.ini, mapa)) return { ok: false, motivo: 'el comando no esta en una lista dentro del archivo (se genera de otra forma)' };

  let a = lim.ini;
  let b = lim.fin + 1;
  let j = b;
  while (j < texto.length && /[ \t]/.test(texto[j])) j++;
  if (texto[j] === ',') {
    b = j + 1;
    while (b < texto.length && /[ \t]/.test(texto[b])) b++;
    const finLinea = texto[b] === '\r' || texto[b] === '\n';
    const antes = texto.slice(texto.lastIndexOf('\n', a - 1) + 1, a);
    if (finLinea && /^[ \t]*$/.test(antes)) {
      if (texto[b] === '\r') b++;
      if (texto[b] === '\n') b++;
      a = a - antes.length;
    }
  } else {
    let k = a - 1;
    while (k >= 0 && /\s/.test(texto[k])) k--;
    if (texto[k] === ',') a = k;
  }
  return { ok: true, texto: texto.slice(0, a) + texto.slice(b) };
}

function quitarAliasDeTexto(texto, name, nth, alias, arreglo) {
  const mapa = mapaDeCodigo(texto);
  const pos = posicionesDeNombre(texto, name, mapa)[nth];
  if (pos === undefined) return { ok: false, motivo: `no encontre "name: '${name}'" en el codigo` };
  const lim = limitesDesde(texto, pos, mapa);
  if (!lim) return { ok: false, motivo: 'no pude ubicar el objeto del comando' };
  const trozo = texto.slice(lim.ini, lim.fin + 1);
  const re = new RegExp(`\\b${arreglo}\\s*:\\s*\\[([^\\]]*)\\]`);
  const m = re.exec(trozo);
  if (!m || !mapa[lim.ini + m.index]) return { ok: false, motivo: `el alias "${alias}" no esta escrito directamente en ${arreglo}: [...]` };
  const tokens = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  const resto = tokens.filter((tk) => { const mm = /^(['"`])(.*)\1$/.exec(tk); return !(mm && mm[2] === alias); });
  if (resto.length === tokens.length) return { ok: false, motivo: `el alias "${alias}" no esta escrito como texto simple en ${arreglo}` };
  const nuevo = `${arreglo}: [${resto.join(', ')}]`;
  const ini = lim.ini + m.index;
  return { ok: true, texto: texto.slice(0, ini) + nuevo + texto.slice(ini + m[0].length) };
}

// ---------------------------------------------------------------- referencias: ¿otro archivo hace require de este?
const cacheProyecto = new Map(); // raiz -> { t, lista:[{ruta, texto}] }
function archivosDelProyecto(raiz) {
  const res = [];
  const recorrer = (dir, prof = 0) => {
    let lista = [];
    try { lista = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of lista) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('_')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (prof < 6) recorrer(p, prof + 1); } else if (e.name.endsWith('.js')) res.push(p);
    }
  };
  recorrer(raiz);
  return res;
}

function textosDelProyecto(raiz) {
  const c = cacheProyecto.get(raiz);
  if (c && Date.now() - c.t < 30000) return c.lista;
  const lista = [];
  for (const f of archivosDelProyecto(raiz)) { try { lista.push({ ruta: f, texto: fs.readFileSync(f, 'utf-8') }); } catch (_) { /* ilegible */ } }
  cacheProyecto.set(raiz, { t: Date.now(), lista });
  return lista;
}

function quienUsaArchivo(rutaAbs, raiz) {
  const base = path.basename(rutaAbs, '.js').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`require\\(\\s*['"\`][^'"\`]*[\\/.]${base}(?:\\.js)?['"\`]\\s*\\)`);
  const usan = [];
  for (const f of textosDelProyecto(raiz)) {
    if (f.ruta === rutaAbs) continue;
    if (re.test(f.texto)) usan.push(aRel(raiz, f.ruta));
  }
  return usan;
}

// ---------------------------------------------------------------- planes
const crypto = require('crypto');
const hashDe = (ruta) => { try { return crypto.createHash('sha1').update(fs.readFileSync(ruta)).digest('hex'); } catch (_) { return null; } };
const sellar = (archivos, base) => { for (const a of archivos) a.hash = hashDe(path.join(base, a.archivo)); return archivos; };
const porNombreYNthDesc = (x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : y.nth - x.nth);
// conservar: { categoria } | { archivo } -> en cada choque se queda la version de esa categoria / archivo (si existe)
function planificarLimpieza(entradas, dups, { conservar = null, soloCategoria = null, raiz = RAIZ, base = BASE_COMANDOS } = {}) {
  const porArchivo = new Map(); // archivo -> { entradasPerdidas:Set(idEntrada), nombres:[{name,nth}], alias:[{name,nth,alias,arreglo}], ... }
  const bloqueadas = [];
  const fueraDeAlcance = new Set(); // choques cuyo repetido esta en OTRA categoria (si pidieron limpiar solo una)
  const cambiaComportamiento = [];
  const pierdeAlias = new Set();

  const infoArchivo = (archivo) => {
    if (!porArchivo.has(archivo)) porArchivo.set(archivo, { archivo, quitaEntradas: new Map(), quitaAlias: [] });
    return porArchivo.get(archivo);
  };
  const nthDe = (entrada) => entradas.filter((x) => x.archivo === entrada.archivo && x.name === entrada.name && x.indice < entrada.indice).length;

  for (const d of dups) {
    let conservada = d.conservada === undefined ? d.ganador : d.conservada; // por defecto: la que esta activa hoy; null = quitar todas
    if (conservar && conservada) {
      const coincide = d.ocurrencias.filter((o) => (conservar.categoria && o.entrada.categoria === conservar.categoria) || (conservar.archivo && o.entrada.archivo === conservar.archivo));
      if (coincide.length) {
        conservada = coincide[coincide.length - 1];
        if (conservada !== d.ganador) cambiaComportamiento.push(d.clave);
      }
    }
    for (const o of d.ocurrencias) {
      if (conservada && (o === conservada || idEntrada(o.entrada) === idEntrada(conservada.entrada))) continue; // la misma entrada repetida a si misma
      if (soloCategoria && o.entrada.categoria !== soloCategoria) { fueraDeAlcance.add(d.clave); continue; }
      if (PROTEGIDOS.has(o.entrada.archivo)) { bloqueadas.push({ clave: d.clave, archivo: o.entrada.archivo, motivo: 'archivo protegido (es el propio mantenimiento)' }); continue; }
      const f = infoArchivo(o.entrada.archivo);
      if (o.via === 'name') {
        f.quitaEntradas.set(idEntrada(o.entrada), { entrada: o.entrada, clave: d.clave });
      } else {
        f.quitaAlias.push({ entrada: o.entrada, alias: d.clave, arreglo: o.via === 'oculta' ? 'aliasesOcultas' : 'aliases' });
      }
    }
  }

  const archivos = [];
  for (const f of porArchivo.values()) {
    const ent = entradas.filter((e) => e.archivo === f.archivo);
    const rutaAbs = path.join(base, f.archivo);
    const total = ent.length;
    const entradasQuitadas = [...f.quitaEntradas.values()].map((x) => x.entrada);
    // las entradas que se quitan ya no necesitan que les quiten alias
    const quitaAlias = f.quitaAlias.filter((a) => !f.quitaEntradas.has(idEntrada(a.entrada)));

    if (entradasQuitadas.length && entradasQuitadas.length === total && ent.every((e) => e.origen === 'cargado' || e.origen === 'texto')) {
      // TODO el archivo son repetidos: se mueve completo
      const usan = quienUsaArchivo(rutaAbs, raiz);
      if (usan.length) {
        for (const q of f.quitaEntradas.values()) bloqueadas.push({ clave: q.clave, archivo: f.archivo, motivo: `otro archivo lo usa (${usan.slice(0, 2).join(', ')})` });
        continue;
      }
      const propios = new Set(ent.flatMap((e) => [...e.aliases, ...e.ocultas]));
      for (const e of ent) for (const a of [...e.aliases, ...e.ocultas]) if (!dups.some((d) => d.clave === a)) pierdeAlias.add(a);
      archivos.push({ archivo: f.archivo, categoria: ent[0].categoria, modo: 'mover', quita: ent.map((e) => e.name), alias: [...propios], total });
      continue;
    }

    if (ent.some((e) => e.origen !== 'cargado')) {
      for (const q of f.quitaEntradas.values()) bloqueadas.push({ clave: q.clave, archivo: f.archivo, motivo: 'el archivo no carga (arreglalo primero con .repararcmd <categoria>)' });
      for (const a of quitaAlias) bloqueadas.push({ clave: a.alias, archivo: f.archivo, motivo: 'el archivo no carga' });
      continue;
    }

    // Edicion dentro del archivo: se prueba en seco que se pueda hacer todo
    let texto;
    try { texto = fs.readFileSync(rutaAbs, 'utf-8'); } catch (e) { continue; }
    const opNombres = [];
    const opAlias = [];
    const ok = [];
    for (const a of quitaAlias) {
      const nth = nthDe(a.entrada);
      const r = quitarAliasDeTexto(texto, a.entrada.name, nth, a.alias, a.arreglo);
      if (r.ok) { opAlias.push({ name: a.entrada.name, nth, alias: a.alias, arreglo: a.arreglo }); }
      else bloqueadas.push({ clave: a.alias, archivo: f.archivo, motivo: r.motivo });
    }
    const quitar = [...f.quitaEntradas.values()];
    // mismas entradas con el mismo nombre: el nth textual debe coincidir con las cargadas
    const textoOcurr = (name) => posicionesDeNombre(texto, name).length;
    for (const q of quitar) {
      const e = q.entrada;
      const cargadas = ent.filter((x) => x.name === e.name).length;
      if (textoOcurr(e.name) !== cargadas) { bloqueadas.push({ clave: q.clave, archivo: f.archivo, motivo: 'el nombre se arma de forma dinamica en el codigo' }); continue; }
      const nth = nthDe(e);
      // prueba en seco (de atras hacia adelante para que los indices no se muevan)
      ok.push({ name: e.name, nth, clave: q.clave, entrada: e });
    }
    ok.sort(porNombreYNthDesc);
    let prueba = texto;
    const aplicables = [];
    for (const op of opAlias) { const r = quitarAliasDeTexto(prueba, op.name, op.nth, op.alias, op.arreglo); if (r.ok) prueba = r.texto; }
    for (const op of ok) {
      const r = quitarEntradaDeTexto(prueba, op.name, op.nth);
      if (r.ok) { prueba = r.texto; aplicables.push(op); } else bloqueadas.push({ clave: op.clave, archivo: f.archivo, motivo: r.motivo });
    }
    if (!aplicables.length && !opAlias.length) continue;
    try { new vm.Script(prueba, { filename: f.archivo }); } catch (e) {
      bloqueadas.push({ clave: '(varios)', archivo: f.archivo, motivo: `al editarlo quedaria con error de sintaxis (${String(e.message).slice(0, 60)})` });
      continue;
    }
    for (const op of aplicables) {
      for (const a of [...op.entrada.aliases, ...op.entrada.ocultas]) if (!dups.some((d) => d.clave === a)) pierdeAlias.add(a);
    }
    archivos.push({
      archivo: f.archivo, categoria: ent[0].categoria, modo: 'editar', total,
      quitaEntradas: aplicables.map((o) => ({ name: o.name, nth: o.nth })),
      quitaAlias: opAlias,
      quita: aplicables.map((o) => o.name), alias: opAlias.map((o) => o.alias)
    });
  }

  return { tipo: 'limpiar', archivos: sellar(archivos, base), bloqueadas, cambiaComportamiento, pierdeAlias: [...pierdeAlias], fueraDeAlcance: [...fueraDeAlcance], choques: dups.length };
}

function planDeEliminarComando(entradas, nombre, { raiz = RAIZ, base = BASE_COMANDOS } = {}) {
  const lista = apariciones(entradas).get(nombre) || [];
  if (!lista.length) {
    return { tipo: 'eliminar', objetivo: nombre, archivos: [], bloqueadas: [{ clave: nombre, archivo: '-', motivo: 'no existe un comando con ese nombre' }], cambiaComportamiento: [], pierdeAlias: [], choques: 0 };
  }
  const plan = planificarLimpieza(entradas, [{ clave: nombre, ocurrencias: lista, ganador: lista[lista.length - 1], conservada: null }], { raiz, base });
  plan.tipo = 'eliminar';
  plan.objetivo = nombre;
  return plan;
}

function planDeMover(entradas, nombre, categoriaDestino, { base = BASE_COMANDOS } = {}) {
  const e = entradas.filter((x) => x.name === nombre);
  const bloq = (motivo) => ({ tipo: 'mover', archivos: [], bloqueadas: [{ clave: nombre, archivo: e[0] ? e[0].archivo : '-', motivo }], cambiaComportamiento: [], pierdeAlias: [], choques: 0 });
  if (!e.length) return bloq('no existe un comando con ese nombre');
  if (e.length > 1) return bloq('el nombre esta repetido: primero limpia los duplicados');
  const c = e[0];
  if (PROTEGIDOS.has(c.archivo)) return bloq('archivo protegido');
  if (c.total > 1) return bloq('su archivo trae varios comandos juntos; no se puede mover uno solo');
  if (c.categoria === categoriaDestino) return bloq(`ya esta en la categoria "${categoriaDestino}"`);
  if (c.archivo.split('/').length !== 2) return bloq('esta dentro de una subcarpeta (sus rutas relativas se romperian)');
  const texto = (() => { try { return fs.readFileSync(path.join(base, c.archivo), 'utf-8'); } catch (_) { return ''; } })();
  if (/require\(\s*['"]\.\/[^'"]*['"]\s*\)/.test(texto)) return bloq('importa archivos de su misma carpeta (se romperia al moverlo)');
  const destino = `${categoriaDestino}/${path.basename(c.archivo)}`;
  if (fs.existsSync(path.join(base, destino))) return bloq(`ya existe ${destino}`);
  return { tipo: 'mover', archivos: sellar([{ archivo: c.archivo, categoria: c.categoria, modo: 'mover_categoria', destino, quita: [c.name], alias: [] }], base), bloqueadas: [], cambiaComportamiento: [], pierdeAlias: [], choques: 0, objetivo: nombre, destino: categoriaDestino };
}

// ---------------------------------------------------------------- aplicar (con respaldo, verificacion y rollback)
const dosDigitos = (n) => String(n).padStart(2, '0');
function sello(d = new Date()) {
  return `${d.getFullYear()}${dosDigitos(d.getMonth() + 1)}${dosDigitos(d.getDate())}-${dosDigitos(d.getHours())}${dosDigitos(d.getMinutes())}${dosDigitos(d.getSeconds())}`;
}

// Carga el archivo en OTRO proceso y devuelve lo que exporta (asi no se ejecuta nada raro dentro del bot)
async function inspeccionarArchivo(rutaAbs, raiz = RAIZ) {
  // process.exit explicito: si el archivo deja un setInterval/conexion abierta, el proceso aparte no se queda colgado
  const codigo = `const fin=(o)=>process.stdout.write('\\n@@'+JSON.stringify(o)+'\\n',()=>process.exit(0));` +
    `try{const m=require(${JSON.stringify(rutaAbs)});const l=Array.isArray(m)?m:[m];` +
    `fin({ok:true,c:l.map(c=>({n:c&&c.name,a:[].concat((c&&c.aliases)||[]),o:[].concat((c&&c.aliasesOcultas)||[])}))})}` +
    `catch(e){fin({ok:false,error:String(e&&e.message).split('\\n')[0]})}`;
  try {
    const { stdout } = await execFileP(process.execPath, ['-e', codigo], { cwd: raiz, timeout: 25000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    const linea = String(stdout).split('\n').reverse().find((l) => l.startsWith('@@'));
    return linea ? JSON.parse(linea.slice(2)) : { ok: false, error: 'sin respuesta' };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err).split('\n')[0].slice(0, 120) };
  }
}

// Lo que deberia exportar el archivo despues de quitar lo del plan
function esperadoTras(antes, op) {
  const lista = antes.map((c) => ({ ...c, a: [...c.a], o: [...c.o] }));
  for (const q of (op.quitaAlias || [])) {
    const cand = lista.filter((c) => c.n === q.name);
    const c = cand[q.nth];
    if (c) { c.a = c.a.filter((x) => x !== q.alias); c.o = c.o.filter((x) => x !== q.alias); }
  }
  const porNombre = {};
  for (const q of (op.quitaEntradas || [])) (porNombre[q.name] = porNombre[q.name] || []).push(q.nth);
  const salida = [];
  const visto = {};
  for (const c of lista) {
    const k = visto[c.n] = (visto[c.n] === undefined ? 0 : visto[c.n] + 1);
    if ((porNombre[c.n] || []).includes(k)) continue;
    salida.push(c);
  }
  return salida;
}
const firma = (lista) => JSON.stringify(lista.map((c) => [c.n, [...c.a].sort(), [...c.o].sort()]));

async function aplicarPlan(plan, { base = BASE_COMANDOS, raiz = RAIZ, verificar = inspeccionarArchivo } = {}) {
  let ts = sello();
  for (let n = 2; fs.existsSync(path.join(base, CARPETA_RESPALDOS, ts)); n++) ts = `${sello()}-${dosDigitos(n)}`; // dos operaciones en el mismo segundo no se pisan
  const dirResp = path.join(base, CARPETA_RESPALDOS, ts);
  const hechas = [];
  const fallidas = [];
  const manifest = { ts, tipo: plan.tipo, creado: new Date().toISOString(), archivos: [] };
  const asegurar = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

  for (const op of plan.archivos) {
    const rutaAbs = path.join(base, op.archivo);
    const respaldo = path.join(dirResp, op.archivo);
    try {
      if (!fs.existsSync(rutaAbs)) throw new Error('el archivo ya no existe');
      if (PROTEGIDOS.has(op.archivo)) throw new Error('archivo protegido');
      if (op.hash && hashDe(rutaAbs) !== op.hash) throw new Error('el archivo cambio desde que te mostre el plan; pideme la limpieza de nuevo');
      asegurar(respaldo);

      if (op.modo === 'mover') {
        fs.renameSync(rutaAbs, respaldo);
        delete require.cache[rutaAbs];
        manifest.archivos.push({ archivo: op.archivo, modo: 'mover' });
        hechas.push(op);
        continue;
      }

      if (op.modo === 'mover_categoria') {
        const destinoAbs = path.join(base, op.destino);
        if (fs.existsSync(destinoAbs)) throw new Error(`ya existe ${op.destino}`);
        fs.copyFileSync(rutaAbs, respaldo);
        fs.renameSync(rutaAbs, destinoAbs);
        delete require.cache[rutaAbs];
        const despues = await verificar(destinoAbs, raiz);
        if (!despues.ok) {
          const noVerificable = /Cannot find module '[^./]/.test(despues.error || '');
          if (!noVerificable) { fs.renameSync(destinoAbs, rutaAbs); throw new Error(`al moverlo dejo de cargar (${despues.error}); lo regrese a su lugar`); }
        }
        manifest.archivos.push({ archivo: op.archivo, modo: 'mover_categoria', destino: op.destino });
        hechas.push(op);
        continue;
      }

      // modo "editar"
      const original = fs.readFileSync(rutaAbs, 'utf-8');
      const antes = await verificar(rutaAbs, raiz);
      let texto = original;
      for (const a of (op.quitaAlias || [])) {
        const r = quitarAliasDeTexto(texto, a.name, a.nth, a.alias, a.arreglo);
        if (!r.ok) throw new Error(r.motivo);
        texto = r.texto;
      }
      const quitar = [...(op.quitaEntradas || [])].sort(porNombreYNthDesc);
      for (const q of quitar) {
        const r = quitarEntradaDeTexto(texto, q.name, q.nth);
        if (!r.ok) throw new Error(r.motivo);
        texto = r.texto;
      }
      new vm.Script(texto, { filename: op.archivo }); // sintaxis
      fs.writeFileSync(respaldo, original);           // respaldo del original
      fs.writeFileSync(rutaAbs, texto);
      delete require.cache[rutaAbs];

      const despues = await verificar(rutaAbs, raiz);
      let verificado = false;
      if (antes.ok) {
        if (!despues.ok || firma(esperadoTras(antes.c, op)) !== firma(despues.c)) {
          fs.writeFileSync(rutaAbs, original);
          delete require.cache[rutaAbs];
          throw new Error(despues.ok ? 'tras editarlo no quedaron exactamente los comandos esperados; lo deje como estaba' : `tras editarlo no cargaba (${despues.error}); lo deje como estaba`);
        }
        verificado = true;
      }
      manifest.archivos.push({ archivo: op.archivo, modo: 'editar', verificado });
      hechas.push({ ...op, verificado });
    } catch (err) {
      fallidas.push({ archivo: op.archivo, motivo: String((err && err.message) || err).slice(0, 200) });
    }
  }

  if (manifest.archivos.length) {
    fs.mkdirSync(dirResp, { recursive: true });
    fs.writeFileSync(path.join(dirResp, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  return { ts, dir: dirResp, hechas, fallidas, manifest };
}

// ---------------------------------------------------------------- restaurar
function listarRespaldos(base = BASE_COMANDOS) {
  const dir = path.join(base, CARPETA_RESPALDOS);
  let carpetas = [];
  try { carpetas = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'manifest.json'))).sort(); } catch (_) { /* sin respaldos */ }
  return carpetas.map((ts) => {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(path.join(dir, ts, 'manifest.json'), 'utf-8')); } catch (_) { /* ilegible */ }
    return { ts, archivos: m ? m.archivos : [], tipo: m && m.tipo, restaurado: !!(m && m.restaurado) };
  });
}

function restaurar(ts, { base = BASE_COMANDOS } = {}) {
  const lista = listarRespaldos(base).filter((r) => !r.restaurado);
  const objetivo = ts === 'ultimo' || !ts ? lista[lista.length - 1] : lista.find((r) => r.ts === ts);
  if (!objetivo) return { ok: false, motivo: ts && ts !== 'ultimo' ? `no hay un respaldo "${ts}" pendiente de restaurar` : 'no hay respaldos pendientes de restaurar' };
  const dirResp = path.join(base, CARPETA_RESPALDOS, objetivo.ts);
  const restaurados = [];
  const fallidos = [];
  for (const a of objetivo.archivos) {
    const origenResp = path.join(dirResp, a.archivo);
    const lugar = path.join(base, a.archivo);
    try {
      if (a.modo === 'mover_categoria') {
        const actual = path.join(base, a.destino);
        if (fs.existsSync(actual)) { fs.renameSync(actual, lugar); delete require.cache[actual]; }
        else fs.copyFileSync(origenResp, lugar);
      } else if (a.modo === 'mover') {
        if (fs.existsSync(lugar)) throw new Error('ya hay un archivo en su lugar (no lo piso)');
        fs.mkdirSync(path.dirname(lugar), { recursive: true });
        fs.renameSync(origenResp, lugar);
      } else {
        fs.copyFileSync(origenResp, lugar);
      }
      delete require.cache[lugar];
      restaurados.push(a.archivo);
    } catch (err) {
      fallidos.push({ archivo: a.archivo, motivo: String((err && err.message) || err).slice(0, 120) });
    }
  }
  try {
    const mp = path.join(dirResp, 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mp, 'utf-8'));
    m.restaurado = true; m.restauradoEn = new Date().toISOString();
    fs.writeFileSync(mp, JSON.stringify(m, null, 2));
  } catch (_) { /* sin marcar */ }
  return { ok: true, ts: objetivo.ts, restaurados, fallidos };
}

// ---------------------------------------------------------------- recargar el mapa de comandos del bot en caliente (misma logica que index.js)
function reconstruirMapa(base = BASE_COMANDOS) {
  const mapa = new Map();
  for (const categoria of categoriasActivas(base)) {
    for (const ruta of listarJs(path.join(base, categoria))) {
      let m;
      try { m = require(ruta); } catch (_) { continue; }
      for (const c of (Array.isArray(m) ? m : [m])) {
        if (!c || !c.name) continue;
        if (!c._rutaArchivo) c._rutaArchivo = ruta;
        mapa.set(c.name, c);
        for (const a of textos(c.aliases)) mapa.set(a, c);
        for (const a of textos(c.aliasesOcultas)) mapa.set(a, c);
      }
    }
  }
  return mapa;
}

function recargarEnVivo(comandos, base = BASE_COMANDOS) {
  const nuevo = reconstruirMapa(base);
  let cambios = 0;
  for (const k of [...comandos.keys()]) if (!nuevo.has(k)) { comandos.delete(k); cambios++; }
  for (const [k, v] of nuevo) if (comandos.get(k) !== v) { comandos.set(k, v); cambios++; }
  return cambios;
}

// ---------------------------------------------------------------- salud general
function resumenSalud(base = BASE_COMANDOS) {
  const { entradas, rotos, sinExecute } = escanear(base);
  const dups = detectarDuplicados(entradas);
  const porCategoria = {};
  for (const e of entradas) porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + 1;
  const sinDescripcion = entradas.filter((e) => e.origen === 'cargado' && !e.descripcion).length;
  return { total: entradas.length, porCategoria, rotos, sinExecute, duplicados: dups, sinDescripcion, entradas };
}

module.exports = {
  BASE_COMANDOS, PROTEGIDOS, CARPETA_RESPALDOS,
  escanear, detectarDuplicados, choquesPosibles, apariciones, planificarLimpieza, planDeEliminarComando, planDeMover,
  aplicarPlan, listarRespaldos, restaurar, recargarEnVivo, reconstruirMapa, resumenSalud, inspeccionarArchivo,
  quitarEntradaDeTexto, quitarAliasDeTexto, mapaDeCodigo, quienUsaArchivo, categoriasActivas
};

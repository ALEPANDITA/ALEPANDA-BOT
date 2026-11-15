// Analizador de juegos HTML del arcade: lee un .html, descubre COMO arma el boleto firmado (como el del Flappy),
// comprueba que ese boleto lo pueda validar el bot, adivina cuanto paga y detecta errores tipicos.
//
// Todo es estatico + un "navegador de mentira" dentro de node:vm (sin tocar red ni disco). Como el HTML puede venir de
// cualquier lado, `analizarAislado` lo corre en un proceso hijo aparte, con tiempo limite y sin variables de entorno.
'use strict';

const vm = require('vm');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const TEST = { card: 'K7M2QX', secreto: 'a1b2c3d4e5f6a7b8c9d0', moneda: 137, prefijo: '.', nombre: 'TESTBOT' };

// ───────────── Lector de JS (llaves, comentarios, strings, regex, plantillas) ─────────────
// Devuelve el mapa apertura->cierre de cada { } real (ignorando los que van dentro de strings/comentarios/regex).
function mapearLlaves(codigo) {
  const pares = new Map();
  const pila = [];
  const n = codigo.length;
  let i = 0;
  let prev = ''; // ultimo caracter "significativo"
  let prevPalabra = '';

  const leerString = (q) => {
    i++;
    while (i < n && codigo[i] !== q) { if (codigo[i] === '\\') i++; if (codigo[i] === '\n' && q !== '`') break; i++; }
    i++;
  };
  // Lee el texto de una plantilla `...`; se detiene tras el cierre o dentro de un ${
  const leerPlantilla = () => {
    while (i < n) {
      const c = codigo[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && codigo[i + 1] === '{') { pila.push({ tipo: 'tpl', pos: i + 1 }); i += 2; prev = '{'; return; }
      i++;
    }
  };

  while (i < n) {
    const c = codigo[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && codigo[i + 1] === '/') { while (i < n && codigo[i] !== '\n') i++; continue; }
    if (c === '/' && codigo[i + 1] === '*') { const f = codigo.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
    if (c === '"' || c === "'") { leerString(c); prev = '"'; continue; }
    if (c === '`') { i++; leerPlantilla(); if (prev !== '{') prev = '"'; continue; }
    if (c === '/') {
      const esRegex = prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /^(return|typeof|case|in|of|delete|void|throw|new)$/.test(prevPalabra);
      if (esRegex) {
        i++;
        let enClase = false;
        while (i < n && codigo[i] !== '\n') {
          if (codigo[i] === '\\') { i += 2; continue; }
          if (codigo[i] === '[') enClase = true;
          else if (codigo[i] === ']') enClase = false;
          else if (codigo[i] === '/' && !enClase) break;
          i++;
        }
        i++;
        while (i < n && /[a-z]/i.test(codigo[i])) i++;
        prev = '"';
        continue;
      }
      i++; prev = '/'; continue;
    }
    if (c === '{') { pila.push({ tipo: 'llave', pos: i }); i++; prev = '{'; continue; }
    if (c === '}') {
      const t = pila.pop();
      if (t && t.tipo === 'llave') pares.set(t.pos, i);
      i++;
      if (t && t.tipo === 'tpl') { leerPlantilla(); if (prev !== '{') prev = '"'; } else prev = '}';
      continue;
    }
    if (/[A-Za-z_$0-9]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z_$0-9]/.test(codigo[j])) j++;
      prevPalabra = codigo.slice(i, j);
      i = j; prev = 'a'; continue;
    }
    prevPalabra = '';
    prev = c;
    i++;
  }
  return pares;
}

// ───────────── Extraccion de piezas del HTML ─────────────
function lineaDe(texto, idx) { return texto.slice(0, idx).split('\n').length; }

function scriptsInline(html) {
  const salida = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    // solo JavaScript normal: los modulos (import/export) y los datos (json, shaders) no se pueden revisar aqui
    if (/\btype\s*=/i.test(m[1]) && !/\btype\s*=\s*["']?(?:text|application)\/javascript/i.test(m[1])) continue;
    const inicio = m.index + m[0].indexOf('>') + 1;
    salida.push({ codigo: m[2], inicio, linea: lineaDe(html, inicio) });
  }
  return salida;
}

function funciones(codigo, pares) {
  const lista = [];
  const re = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(codigo))) {
    const abre = m.index + m[0].length - 1;
    const cierra = pares.get(abre);
    if (cierra === undefined) continue;
    lista.push({
      nombre: m[1], params: m[2].split(',').map((p) => p.trim()).filter(Boolean),
      inicio: m.index, abre, cierra, cuerpo: codigo.slice(abre + 1, cierra)
    });
  }
  return lista;
}

// Parte "a, b(c, d), e" en argumentos de primer nivel
function partirArgumentos(texto) {
  const args = [];
  let prof = 0; let actual = ''; let q = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (q) { actual += c; if (c === '\\') { actual += texto[++i] || ''; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; actual += c; continue; }
    if ('([{'.includes(c)) prof++;
    if (')]}'.includes(c)) prof--;
    if (c === ',' && prof === 0) { args.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  if (actual.trim()) args.push(actual.trim());
  return args;
}

function llamadaDe(codigo, nombre, pares) {
  const re = new RegExp(`(?<![\\w$.])${nombre.replace(/\$/g, '\\$')}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(codigo))) {
    if (/function\s*$/.test(codigo.slice(Math.max(0, m.index - 12), m.index))) continue;
    // buscar el cierre del parentesis respetando strings
    let i = m.index + m[0].length; let prof = 1; let q = null;
    const ini = i;
    for (; i < codigo.length && prof > 0; i++) {
      const c = codigo[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '(') prof++; else if (c === ')') prof--;
    }
    if (prof === 0) return partirArgumentos(codigo.slice(ini, i - 1));
  }
  return null;
}

// ───────────── Roles de los argumentos del firmador ─────────────
function rolDeArgumento(param, expr) {
  const texto = `${expr || ''} ${param || ''}`;
  if (/secret|secreto|clave|salt|\bkey\b/i.test(texto)) return 'secreto';
  if (/card|tarjeta|ticket|boleto/i.test(texto)) return 'card';
  if (/dur|sec(?!ret)|seg|time|tiemp|elapsed/i.test(texto)) return 'segundos';
  if (/coin|moned|gold|\boro\b|gem|gema|estrell|star|cash|money|dinero/i.test(texto)) return 'monedas';
  if (/score|punt|pipe|tuber|lap|vuelt|dist|level|nivel|kill|point|height|altura|wave|oleada|combo|\bhit|goal|\bgol|meta|run\b|carrera/i.test(texto)) return 'puntaje';
  return 'extra';
}

// ───────────── "Navegador de mentira" dentro de vm ─────────────
const PRELUDIO = `
(function (g) {
  var guardado = new WeakMap();
  function falso(nombre) {
    var f = function () {};
    var almacen = {};
    var p = new Proxy(f, {
      get: function (t, k) {
        if (k === Symbol.toPrimitive) return function (h) { return h === 'string' ? '' : 0; };
        if (k === 'then') return undefined;
        if (k === 'length') return 0;
        if (k === 'toString' || k === 'valueOf') return function () { return ''; };
        if (Object.prototype.hasOwnProperty.call(almacen, k)) return almacen[k];
        return falso(String(k));
      },
      set: function (t, k, v) { almacen[k] = v; return true; },
      has: function () { return true; },
      apply: function () { return falso('ret'); },
      construct: function () { return falso('new'); }
    });
    return p;
  }
  var memoria = {};
  g.window = g; g.self = g; g.top = g; g.parent = g;
  g.document = falso('document');
  g.navigator = falso('navigator');
  g.screen = falso('screen');
  g.history = falso('history');
  g.localStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(memoria, k) ? memoria[k] : null; }, setItem: function (k, v) { memoria[k] = String(v); }, removeItem: function (k) { delete memoria[k]; }, clear: function () { memoria = {}; } };
  g.sessionStorage = g.localStorage;
  g.location = { search: '', href: 'file:///juego.html', hash: '', origin: 'null', protocol: 'file:' };
  g.performance = { now: function () { return 0; } };
  g.__timers = 0;
  g.requestAnimationFrame = function () { return 1; };
  g.cancelAnimationFrame = function () {};
  g.setTimeout = function () { g.__timers++; return 1; };
  g.setInterval = function () { g.__timers++; return 1; };
  g.clearTimeout = function () {}; g.clearInterval = function () {};
  g.addEventListener = function () {}; g.removeEventListener = function () {};
  g.URLSearchParams = function () { this.get = function () { return null; }; this.has = function () { return false; }; };
  g.AudioContext = g.webkitAudioContext = function () { return falso('audio'); };
  g.Image = function () { return falso('img'); };
  g.Audio = function () { return falso('audio'); };
  g.fetch = function () { g.__red = (g.__red || 0) + 1; return Promise.reject(new Error('sin red')); };
  g.XMLHttpRequest = function () { g.__red = (g.__red || 0) + 1; return falso('xhr'); };
  g.alert = g.confirm = g.prompt = function () {};
  g.matchMedia = function () { return { matches: false, addEventListener: function () {} }; };
  g.innerWidth = 360; g.innerHeight = 640; g.devicePixelRatio = 1;
})(globalThis);
`;

function crearContexto() {
  const ctx = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(PRELUDIO, ctx, { timeout: 1000 });
  return ctx;
}

// ───────────── HMAC / referencia del bot ─────────────
const firmaBot = (secreto, card, data) => crypto.createHmac('sha256', secreto).update(`${card}:${data}`).digest('hex').slice(0, 6).toUpperCase();

function rellenarMarcadores(html) {
  return html
    .replace(/__CARD_ID__/g, TEST.card).replace(/__CARD_SECRET__/g, TEST.secreto)
    .replace(/__COIN_VAL__/g, String(TEST.moneda)).replace(/__PREFIX__/g, TEST.prefijo)
    .replace(/__BOT_NAME__/g, TEST.nombre).replace(/\n[^\n]*(?:__OG_IMAGE__|og:image:)[^\n]*/g, '');
}

// ───────────── Analisis principal ─────────────
const problema = (nivel, codigo, texto, arreglo = null) => ({ nivel, codigo, texto, arreglo });

function inyectarCaptura(codigo, funcion, pares) {
  // Entra la referencia al firmador (hoisting): se pone al principio del bloque que contiene la declaracion
  let bloque = -1;
  for (const [abre, cierra] of pares) if (abre < funcion.inicio && cierra > funcion.inicio && abre > bloque) bloque = abre;
  const captura = `globalThis.__FIRMADOR__ = ${funcion.nombre};`;
  if (bloque < 0) {
    const m = /^\s*(['"])use strict\1;?/.exec(codigo);
    const pos = m ? m[0].length : 0;
    return codigo.slice(0, pos) + captura + codigo.slice(pos);
  }
  const resto = codigo.slice(bloque + 1);
  const m = /^\s*(['"])use strict\1;?/.exec(resto);
  const pos = bloque + 1 + (m ? m[0].length : 0);
  return codigo.slice(0, pos) + captura + codigo.slice(pos);
}

function elegirFirmador(lista) {
  const cand = lista.filter((f) => f.params.length >= 2 && /hmac/i.test(f.cuerpo) && /toUpperCase/.test(f.cuerpo) && /return[^;]*['"`][^'"`]*-/.test(f.cuerpo));
  const puntuar = (f) => (/sign|code|codigo|boleto|ticket|token|firma/i.test(f.nombre) ? 2 : 0) + (f.params.length >= 4 ? 1 : 0);
  return cand.sort((a, b) => puntuar(b) - puntuar(a))[0] || null;
}

function llamarFirmador(ctx, argumentos) {
  const js = `(function(){try{return 'OK:'+String(__FIRMADOR__.apply(null, ${JSON.stringify(argumentos)}))}catch(e){return 'ERR:'+String(e&&e.message)}})()`;
  const r = String(vm.runInContext(js, ctx, { timeout: 1500 }));
  return r.startsWith('OK:') ? { ok: true, codigo: r.slice(3) } : { ok: false, error: r.slice(4) };
}

// Descubre el formato del boleto variando un argumento a la vez
function descubrirFormato(ctx, roles) {
  const base = roles.map((r) => (r === 'card' ? TEST.card : (r === 'secreto' ? TEST.secreto : 0)));
  const idxNum = roles.map((r, i) => (r === 'card' || r === 'secreto' ? -1 : i)).filter((i) => i >= 0);
  const armar = (cambios = {}) => base.map((v, i) => (i in cambios ? cambios[i] : v));
  const partir = (c) => {
    const m = /^([A-Z]{2,6})-([A-Z0-9]{6})-([0-9A-F]{9,46})$/.exec(c);
    return m ? { tag: m[1], card: m[2], cuerpo: m[3], data: m[3].slice(0, -6), firma: m[3].slice(-6) } : null;
  };

  const r0 = llamarFirmador(ctx, armar());
  if (!r0.ok) return { error: `El firmador fallo al probarlo: ${r0.error}` };
  const p0 = partir(r0.codigo);
  if (!p0) return { error: `El boleto que arma no tiene la forma TAG-TARJETA-DATOS (armó "${r0.codigo}").`, ejemplo: r0.codigo };

  // Nonce: posiciones que cambian entre llamadas identicas
  const cambia = new Set();
  const corridas = [p0];
  for (let k = 0; k < 8; k++) {
    const r = llamarFirmador(ctx, armar());
    const p = r.ok && partir(r.codigo);
    if (!p || p.data.length !== p0.data.length) return { error: 'El largo del boleto cambia entre llamadas iguales.' };
    for (let i = 0; i < p.data.length; i++) if (p.data[i] !== p0.data[i]) cambia.add(i);
    corridas.push(p);
  }
  const L = p0.data.length;
  const nonce = new Set(cambia);
  if (nonce.size) { const lo = Math.min(...nonce); const hi = Math.max(...nonce); for (let i = lo; i <= hi; i++) nonce.add(i); }

  // Campo de cada argumento numerico
  const campos = [];
  for (const i of idxNum) {
    const soporte = new Set();
    let desborda = false; let hexOk = true;
    for (const v of [1, 17, 255, 4095, 65535]) {
      const r = llamarFirmador(ctx, armar({ [i]: v }));
      const p = r.ok && partir(r.codigo);
      if (!p) return { error: `El firmador fallo con valores grandes: ${r.error || r.codigo}` };
      if (p.data.length !== L) { desborda = true; continue; }
      for (let k = 0; k < L; k++) if (!nonce.has(k) && p.data[k] !== p0.data[k]) soporte.add(k);
      if (v === 17 && p.data.length === L) {
        // comprobar que el valor se guarda en hexadecimal (17 = "11")
        const pos = [...soporte].sort((a, b) => a - b);
        if (pos.length && parseInt(p.data.slice(pos[0], pos[pos.length - 1] + 1), 16) !== 17 && !desborda) hexOk = false;
      }
    }
    const pos = [...soporte].sort((a, b) => a - b);
    if (!pos.length) { campos.push({ arg: i, inicio: null, hex: 0 }); continue; }
    if (pos[pos.length - 1] - pos[0] + 1 !== pos.length) return { error: `El argumento ${i + 1} reparte sus datos en posiciones separadas; no lo sé leer.` };
    campos.push({ arg: i, inicio: pos[0], hex: pos.length, desborda, hexOk });
  }
  return { tag: p0.tag, largo: L, nonce: [...nonce].sort((a, b) => a - b), campos, corridas, base: p0 };
}

function evaluarPremio(expr, nombresPorRol) {
  // Evalua una expresion de premio de la pagina con valores de prueba y ajusta un modelo lineal
  const idents = [...new Set((expr.match(/[A-Za-z_$][\w$]*/g) || []).filter((x) => !/^(Math|Number|parseInt|parseFloat|floor|round|ceil|min|max|abs|COIN_VAL)$/.test(x)))];
  const f = (vals) => {
    const decl = idents.map((id) => `var ${id}=${JSON.stringify(vals[id] != null ? vals[id] : 0)};`).join('');
    const r = vm.runInNewContext(`(function(){${decl}var COIN_VAL=${TEST.moneda};return (${expr});})()`, Object.create(null), { timeout: 500 });
    return typeof r === 'number' && Number.isFinite(r) ? r : null;
  };
  const roles = Object.keys(nombresPorRol);
  const ceros = {};
  const c0 = f(ceros);
  if (c0 === null) return null;
  const coef = {};
  const unit = (rol) => ({ [nombresPorRol[rol]]: 10 });
  for (const rol of roles) {
    const v = f(unit(rol));
    if (v === null) return null;
    coef[rol] = (v - c0) / 10;
  }
  // verificacion de linealidad con una combinacion
  const combo = {}; let esperado = c0;
  roles.forEach((rol, i) => { combo[nombresPorRol[rol]] = 7 + i * 5; esperado += coef[rol] * (7 + i * 5); });
  const real = f(combo);
  if (real === null || Math.abs(real - esperado) > 0.5) return null;
  return { constante: c0, coef };
}

// Carga el juego en el navegador de mentira (con el firmador a la mano) y deduce el rol de cada argumento
function prepararFirmador(scriptsPrueba, firmador, scriptDelFirmador, paresDelScript) {
  const llamada = llamadaDe(scriptDelFirmador.codigo, firmador.nombre, paresDelScript);
  const roles = firmador.params.map((p, i) => rolDeArgumento(p, llamada ? llamada[i] : ''));
  const usados = new Set(); // un solo puntaje / monedas / segundos
  const nombresCampo = roles.map((r) => {
    if (r === 'card' || r === 'secreto') return null;
    const base = r;
    let n = r; let k = 1;
    if (usados.has(n)) { n = 'extra'; }
    while (usados.has(n)) n = `${base === 'extra' || n === 'extra' ? 'extra' : base}${++k}`;
    usados.add(n);
    return n;
  });
  const ctx = crearContexto();
  const instrumentado = inyectarCaptura(scriptDelFirmador.codigo, firmador, paresDelScript);
  // Se corren TODOS los scripts (el del firmador instrumentado) para detectar fallos al cargar
  const errorCarga = [];
  scriptsPrueba.forEach((s, n) => {
    const codigo = s === scriptDelFirmador ? instrumentado : s.codigo;
    try { new vm.Script(codigo).runInContext(ctx, { timeout: 1500 }); }
    catch (err) { errorCarga.push({ n: n + 1, mensaje: String(err && err.message), nombre: String(err && err.name) }); }
  });
  const hayFirmador = vm.runInContext('typeof __FIRMADOR__', ctx) === 'function';
  return { ctx, roles, exprs: llamada || [], nombresCampo, errorCarga, hayFirmador };
}

function localizarFirmador(scriptsPrueba) {
  for (const s of scriptsPrueba) {
    const pares = mapearLlaves(s.codigo);
    const f = elegirFirmador(funciones(s.codigo, pares));
    if (f) return { firmador: f, scriptDelFirmador: s, paresDelScript: pares };
  }
  return null;
}

// Arma un boleto con la pagina ya personalizada (tarjeta y secreto reales de prueba). valores: { puntaje, monedas, segundos, ... }
function generarBoleto(html, { card, secreto, valores = {} }) {
  const scripts = scriptsInline(String(html));
  const loc = localizarFirmador(scripts);
  if (!loc) return { ok: false, error: 'No encuentro el firmador del boleto.' };
  const prep = prepararFirmador(scripts, loc.firmador, loc.scriptDelFirmador, loc.paresDelScript);
  if (!prep.hayFirmador) return { ok: false, error: 'No pude ejecutar el firmador.' };
  const args = prep.roles.map((r, i) => (r === 'card' ? card : (r === 'secreto' ? secreto : (valores[prep.nombresCampo[i]] != null ? valores[prep.nombresCampo[i]] : 1))));
  const r = llamarFirmador(prep.ctx, args);
  return r.ok ? { ok: true, codigo: r.codigo } : { ok: false, error: r.error };
}

function analizar(htmlOriginal) {
  const html = String(htmlOriginal || '');
  const problemas = [];
  const informe = {
    bytes: Buffer.byteLength(html), titulo: null, problemas, protocolo: null, marcadores: {}, premio: null, sugerido: null, arreglosDisponibles: [], listo: false
  };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  informe.titulo = t ? t[1].replace(/__BOT_NAME__/g, '').replace(/\s+/g, ' ').replace(/[·|–-]\s*Arcade\s*$/i, '').trim() : null;

  if (html.length < 200) { problemas.push(problema('error', 'vacio', 'El archivo está casi vacío; no parece un juego.')); return cerrar(informe); }
  if (!/<(canvas|div|body|script)\b/i.test(html)) { problemas.push(problema('error', 'no-html', 'No parece una página HTML de juego.')); return cerrar(informe); }

  // ── Estructura basica
  if (!/<!doctype html/i.test(html)) problemas.push(problema('aviso', 'doctype', 'Le falta <!DOCTYPE html> (puede verse raro en el celular).', 'doctype'));
  if (!/<meta[^>]+charset/i.test(html)) problemas.push(problema('aviso', 'charset', 'No declara la codificación (los emojis y acentos pueden verse como signos raros).', 'charset'));
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problemas.push(problema('aviso', 'viewport', 'No tiene la etiqueta "viewport": en el celular se vería diminuto o desacomodado.', 'viewport'));

  // ── Recursos externos (el juego va como archivo y debe funcionar sin depender de internet)
  const externos = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']?(https?:)?\/\/([^"'\s>]+)/gi)) externos.push(`script ${m[2].split('/')[0]}`);
  const fuentes = [...html.matchAll(/<link\b[^>]*href\s*=\s*["']?(?:https?:)?\/\/(fonts\.(?:googleapis|gstatic)\.com)[^>]*>/gi)];
  const importFuentes = /@import\s+url\(\s*["']?(?:https?:)?\/\/fonts\./i.test(html);
  if (externos.length) problemas.push(problema('error', 'scripts-externos', `Carga código desde internet (${[...new Set(externos)].join(', ')}). Como archivo dentro de WhatsApp puede no abrir o quedar en blanco; necesita ir todo dentro del mismo HTML.`));
  if (fuentes.length || importFuentes) problemas.push(problema('aviso', 'fuentes-externas', 'Pide tipografías a Google Fonts; sin internet se ve con la letra del sistema.', 'fuentes'));
  const imgsExt = [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']https?:/gi)];
  if (imgsExt.length) problemas.push(problema('aviso', 'imagenes-externas', `Usa ${imgsExt.length} imagen(es) desde internet; si el enlace cae, no se ven.`));

  // ── Scripts: sintaxis
  const scripts = scriptsInline(html);
  if (!scripts.length) problemas.push(problema('error', 'sin-js', 'No tiene JavaScript propio dentro del archivo.'));
  const prueba = rellenarMarcadores(html);
  const scriptsPrueba = scriptsInline(prueba);
  let sintaxisOk = true;
  scriptsPrueba.forEach((s, n) => {
    try { new vm.Script(s.codigo, { filename: `script${n + 1}` }); }
    catch (err) {
      sintaxisOk = false;
      const m = /script\d+:(\d+)/.exec(String(err.stack || ''));
      const linea = m ? Number(m[1]) + s.linea - 1 : s.linea;
      const lineas = prueba.split('\n');
      const fragmento = lineas.slice(Math.max(0, linea - 3), linea + 2).map((l, i) => `${Math.max(1, linea - 2) + i}: ${l.slice(0, 140)}`).join('\n');
      problemas.push({ ...problema('error', 'sintaxis', `Error de sintaxis en la línea ${linea}: ${err.message}`, null), linea, fragmento });
    }
  });

  // ── Marcadores del bot
  informe.marcadores = {
    card: /__CARD_ID__/.test(html), secreto: /__CARD_SECRET__/.test(html), moneda: /__COIN_VAL__/.test(html),
    prefijo: /__PREFIX__/.test(html), nombre: /__BOT_NAME__/.test(html)
  };

  // ── Firmador del boleto
  let firmador = null; let scriptDelFirmador = null; let paresDelScript = null;
  if (sintaxisOk) {
    const loc = localizarFirmador(scriptsPrueba);
    if (loc) ({ firmador, scriptDelFirmador, paresDelScript } = loc);
  }

  if (!firmador) {
    if (sintaxisOk) problemas.push(problema('error', 'sin-protocolo', 'No encuentro dónde el juego arma el boleto firmado (el código FOX-... que se cobra con .reclamar). Sin eso el bot no puede pagar.', 'integrar'));
    return cerrar(informe);
  }

  const prep = prepararFirmador(scriptsPrueba, firmador, scriptDelFirmador, paresDelScript);
  const { ctx, roles, exprs, nombresCampo, errorCarga } = prep;
  if (!prep.hayFirmador) {
    problemas.push(problema('error', 'firmador-inaccesible', 'Encontré la función que arma el boleto pero no pude ejecutarla para probarla.'));
    return cerrar(informe);
  }
  for (const e of errorCarga) {
    if (/timed out/i.test(e.mensaje)) {
      problemas.push(problema('error', 'ciclo-al-cargar', 'Al cargar, el juego se queda en un ciclo que no termina (la página se congelaría antes de empezar).'));
      continue;
    }
    const grave = e.nombre === 'ReferenceError' || e.nombre === 'SyntaxError';
    problemas.push(problema(grave ? 'error' : 'aviso', 'error-al-cargar', `Al cargar el juego (en un navegador de prueba) falla con: ${e.nombre}: ${e.mensaje}${grave ? '' : ' (puede ser limitación de mi prueba)'}`));
  }

  const formato = descubrirFormato(ctx, roles);
  if (formato.error) {
    problemas.push(problema('error', 'boleto', formato.error));
    return cerrar(informe);
  }

  // Campos en orden de posicion (huecos = relleno)
  const porPos = formato.campos.filter((c) => c.hex > 0).map((c) => ({ ...c, nombre: nombresCampo[c.arg], texto: false })).sort((a, b) => a.inicio - b.inicio);
  const ignorados = formato.campos.filter((c) => c.hex === 0).map((c) => nombresCampo[c.arg]);
  const nonceRango = formato.nonce.length ? { inicio: formato.nonce[0], hex: formato.nonce.length } : null;
  const piezas = [...porPos.map((c) => ({ nombre: c.nombre, inicio: c.inicio, hex: c.hex, texto: false }))];
  if (nonceRango) piezas.push({ nombre: 'nonce', inicio: nonceRango.inicio, hex: nonceRango.hex, texto: true, oculto: true });
  piezas.sort((a, b) => a.inicio - b.inicio);
  const camposManifiesto = [];
  let cursor = 0; let nRelleno = 0; let solapa = false;
  for (const p of piezas) {
    if (p.inicio < cursor) { solapa = true; break; }
    if (p.inicio > cursor) camposManifiesto.push({ nombre: `relleno${++nRelleno}`, hex: p.inicio - cursor, texto: true, oculto: true });
    camposManifiesto.push({ nombre: p.nombre, hex: p.hex, texto: p.texto, oculto: !!p.oculto });
    cursor = p.inicio + p.hex;
  }
  if (cursor < formato.largo && !solapa) camposManifiesto.push({ nombre: `relleno${++nRelleno}`, hex: formato.largo - cursor, texto: true, oculto: true });
  if (solapa) { problemas.push(problema('error', 'boleto', 'Los campos del boleto se pisan entre sí; no lo sé leer.')); return cerrar(informe); }
  if (porPos.some((c) => c.hexOk === false)) { problemas.push(problema('error', 'boleto', 'El boleto guarda los números en un formato que no es hexadecimal; el bot no lo sabe leer.')); return cerrar(informe); }

  // ¿La firma coincide con la que calcula el bot?
  let firmaOk = true;
  for (const c of formato.corridas.slice(0, 4)) {
    if (firmaBot(TEST.secreto, c.card, c.data) !== c.firma) { firmaOk = false; break; }
  }
  if (!firmaOk) {
    problemas.push(problema('error', 'firma', 'La firma del boleto NO coincide con la que calcula el bot (HMAC-SHA256 de "tarjeta:datos", primeros 6 hex en mayúsculas). El bot rechazaría todos los boletos.'));
  }
  if (formato.campos.some((c) => c.desborda)) problemas.push(problema('aviso', 'desborda', 'Algún valor muy grande desborda el espacio del boleto (la página no lo limita). El bot lo rechazaría por largo.'));

  const idCardEnArg = roles.includes('card');
  if (!idCardEnArg) problemas.push(problema('aviso', 'sin-tarjeta-arg', 'El firmador no recibe la tarjeta como argumento; la leo del juego tal cual.'));

  // ── Marcadores de tarjeta/secreto
  const falta = [];
  if (!informe.marcadores.card) falta.push('__CARD_ID__');
  if (!informe.marcadores.secreto) falta.push('__CARD_SECRET__');
  if (falta.length) {
    problemas.push(problema('error', 'marcadores', `No tiene ${falta.join(' ni ')}: el bot no puede ponerle la tarjeta y el secreto de cada jugador. Hoy usaría valores fijos y nadie podría cobrar.`, 'marcadores'));
  }
  if (!informe.marcadores.moneda) problemas.push(problema('info', 'sin-moneda', 'No usa __COIN_VAL__: el valor de la moneda que muestra la página no cambia con .arcade config moneda.'));
  if (!informe.marcadores.prefijo) problemas.push(problema('info', 'sin-prefijo', 'No usa __PREFIX__: el comando para cobrar que muestra la página lleva el prefijo fijo.'));

  // ── Premio: se intenta leer de la formula de la pagina
  let premio = null;
  const nombresPorRol = {};
  roles.forEach((r, i) => {
    const e = exprs[i] || '';
    if (nombresCampo[i] && /^[A-Za-z_$][\w$]*$/.test(e)) nombresPorRol[nombresCampo[i]] = e;
  });
  const rolesNumericos = Object.keys(nombresPorRol).filter((r) => r !== 'segundos');
  const reContiene = /(?:^|[\s;{(])(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*\bCOIN_VAL\b[^;\n]*);/g;
  const candidatos = [];
  let mm;
  while ((mm = reContiene.exec(scriptDelFirmador.codigo))) candidatos.push(mm[2]);
  if (!candidatos.length) {
    const reNombre = /(?:var|let|const)\s+(?:earned|reward|premio|ganancia|prize|total\w*|ganado)\s*=\s*([^;\n]+);/gi;
    while ((mm = reNombre.exec(scriptDelFirmador.codigo))) candidatos.push(mm[1]);
  }
  for (const expr of candidatos) {
    try {
      const fit = evaluarPremio(expr, Object.fromEntries(rolesNumericos.map((r) => [r, nombresPorRol[r]])));
      if (fit && Object.values(fit.coef).some((c) => c > 0)) { premio = { ...fit, expr: expr.trim(), fuente: 'pagina' }; break; }
    } catch (_) { /* siguiente candidato */ }
  }

  const prem = {};
  if (premio) {
    for (const [campo, c] of Object.entries(premio.coef)) {
      if (c <= 0) continue;
      const k = c / TEST.moneda;
      if (informe.marcadores.moneda && k >= 1 && Math.abs(k - Math.round(k)) < 1e-9) prem[campo] = k === 1 ? '$moneda' : `${Math.round(k)}*$moneda`;
      else prem[campo] = Math.round(c * 100) / 100;
    }
    if (premio.constante > 0) prem.constante = premio.constante;
  } else {
    const hayPuntaje = nombresCampo.includes('puntaje');
    if (hayPuntaje) prem.puntaje = 1;
    if (nombresCampo.includes('monedas')) prem.monedas = '$moneda';
    if (!Object.keys(prem).length) { const n = nombresCampo.find((x) => x && x !== 'segundos'); if (n) prem[n] = 1; }
  }
  informe.premio = { fuente: premio ? 'pagina' : 'defecto', expr: premio ? premio.expr : null, premio: prem };

  // ── Reglas anti-trampa por defecto
  const reglas = {};
  if (nombresCampo.includes('segundos')) { reglas.segundos = 'segundos'; reglas.segundosBase = 1; reglas.segundosPorPunto = 0; reglas.maxPorSegundo = 5; }
  reglas.conteo = ['puntaje', 'monedas'].filter((n) => nombresCampo.includes(n));
  if (nombresCampo.includes('monedas') && nombresCampo.includes('puntaje')) { reglas.monedas = 'monedas'; reglas.monedasExtra = 1; }

  const puntajeNombre = nombresCampo.includes('puntaje') ? 'puntaje' : (nombresCampo.find((x) => x && x !== 'segundos' && x !== 'monedas') || nombresCampo.find(Boolean));
  const sugerido = {
    tag: formato.tag,
    titulo: informe.titulo || 'Mi juego',
    campos: camposManifiesto,
    puntaje: puntajeNombre,
    premio: prem,
    reglas
  };
  informe.sugerido = sugerido;
  informe.protocolo = {
    funcion: firmador.nombre, roles, nombresCampo, tag: formato.tag, largoDatos: formato.largo, firmaOk,
    ejemplo: formato.base ? `${formato.tag}-${formato.base.card}-${formato.base.cuerpo}` : null,
    llamada: exprs, ignorados
  };

  // ── Otros avisos utiles
  const todo = scripts.map((s) => s.codigo).join('\n');
  if (/navigator\.clipboard/.test(todo) && !/execCommand\(\s*['"]copy['"]/.test(todo)) {
    problemas.push(problema('aviso', 'clipboard', 'Copia el código con navigator.clipboard sin plan B; en algunos celulares no copia.', 'clipboard'));
  }
  if (/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(todo) || vm.runInContext('globalThis.__red||0', ctx) > 0) {
    problemas.push(problema('aviso', 'red', 'El juego hace peticiones de red; como archivo no tiene internet garantizado y en modo link el bot las bloquea.'));
  }
  if (/serviceWorker/.test(todo)) problemas.push(problema('info', 'sw', 'Usa serviceWorker; no funciona abierto como archivo.'));

  return cerrar(informe);
}

function cerrar(informe) {
  const errores = informe.problemas.filter((p) => p.nivel === 'error');
  informe.arreglosDisponibles = [...new Set(informe.problemas.map((p) => p.arreglo).filter(Boolean))];
  informe.listo = !errores.length && !!informe.protocolo && informe.protocolo.firmaOk && !!informe.sugerido;
  // lo que queda si se aplican los arreglos automaticos disponibles
  const sinArreglo = errores.filter((p) => !p.arreglo);
  informe.listoConArreglos = !sinArreglo.length && !!informe.protocolo && informe.protocolo.firmaOk && !!informe.sugerido;
  return informe;
}

// ───────────── Arreglos automaticos (reglas cerradas, sin IA) ─────────────
const ARREGLOS = {
  doctype: {
    texto: 'Agregar <!DOCTYPE html>',
    aplicar: (html) => (/<!doctype html/i.test(html) ? html : `<!DOCTYPE html>\n${html}`)
  },
  charset: {
    texto: 'Declarar la codificación UTF-8 (emojis y acentos)',
    aplicar: (html) => {
      if (/<meta[^>]+charset/i.test(html)) return html;
      if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">');
      return html.replace(/<html([^>]*)>/i, '<html$1>\n<head><meta charset="utf-8"></head>');
    }
  },
  viewport: {
    texto: 'Agregar la etiqueta viewport (que se vea bien en el celular)',
    aplicar: (html) => {
      if (/<meta[^>]+name=["']viewport["']/i.test(html)) return html;
      const meta = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">';
      if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>\n${meta}`);
      return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>${meta}</head>`);
    }
  },
  fuentes: {
    texto: 'Quitar las tipografías de Google Fonts (usa la letra del sistema)',
    aplicar: (html) => html
      .replace(/<link\b[^>]*href\s*=\s*["']?(?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi, '')
      .replace(/@import\s+url\(\s*["']?(?:https?:)?\/\/fonts\.[^)]*\)\s*;?/gi, '')
  },
  clipboard: {
    texto: 'Agregar un plan B para copiar el código (funciona en más celulares)',
    aplicar: (html) => {
      if (/__arcadeCopia/.test(html)) return html;
      const shim = `<script>/*__arcadeCopia*/(function(){try{var c=navigator.clipboard;var viejo=c&&c.writeText?c.writeText.bind(c):null;function plan(t){return new Promise(function(ok,no){try{var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(a);a.select();a.setSelectionRange(0,a.value.length);var r=document.execCommand('copy');document.body.removeChild(a);r?ok():no(new Error('copy'));}catch(e){no(e);}});}var nuevo={writeText:function(t){return viejo?viejo(t).catch(function(){return plan(t);}):plan(t);}};try{Object.defineProperty(navigator,'clipboard',{value:nuevo,configurable:true});}catch(e){try{navigator.clipboard=nuevo;}catch(e2){}}}catch(e){}})();</script>`;
      if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>\n${shim}`);
      return shim + html;
    }
  },
  marcadores: {
    texto: 'Poner los marcadores de tarjeta y secreto donde el juego tenía valores fijos',
    aplicar: (html, informe) => {
      const llamada = (informe && informe.protocolo && informe.protocolo.llamada) || [];
      const roles = (informe && informe.protocolo && informe.protocolo.roles) || [];
      let salida = html;
      const poner = (expr, marcador) => {
        if (!expr) return;
        if (/^['"`].*['"`]$/.test(expr)) {
          // el valor va escrito directo en la llamada
          salida = salida.split(expr).join(`'${marcador}'`);
          return;
        }
        if (!/^[A-Za-z_$][\w$]*$/.test(expr)) return;
        const re = new RegExp(`((?:var|let|const)\\s+${expr.replace(/\$/g, '\\$')}\\s*=\\s*)(['"\`])[^'"\`\\n]*\\2`);
        if (re.test(salida)) salida = salida.replace(re, `$1'${marcador}'`);
      };
      poner(llamada[roles.indexOf('card')], '__CARD_ID__');
      poner(llamada[roles.indexOf('secreto')], '__CARD_SECRET__');
      return salida;
    }
  }
};

function aplicarArreglo(id, html, informe) {
  const a = ARREGLOS[id];
  if (!a) return { ok: false, html };
  const nuevo = a.aplicar(html, informe);
  return { ok: nuevo !== html, html: nuevo };
}

// Cambia el tag del boleto (FOX- -> CAR-) en toda la pagina; despues hay que volver a analizar para confirmar
function cambiarTag(html, viejo, nuevo) {
  const re = new RegExp(`(['"\`])${viejo}-`, 'g');
  return html.replace(re, `$1${nuevo}-`).replace(new RegExp(`\\b${viejo}-(?=[A-Z0-9_]{3,}|\\.\\.\\.)`, 'g'), `${nuevo}-`);
}

// ───────────── Proceso aparte ─────────────
// payload: { accion: 'analizar', html } | { accion: 'boleto', html, card, secreto, valores }
function ejecutarAislado(payload, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, ['--max-old-space-size=256', path.join(__dirname, 'arcade-analizar-cli.js')], {
      env: {}, cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe']
    });
    let salida = ''; let err = ''; let terminado = false;
    const fin = (r) => { if (terminado) return; terminado = true; clearTimeout(reloj); resolve(r); };
    const reloj = setTimeout(() => { try { hijo.kill('SIGKILL'); } catch (_) {} fin({ error: 'El análisis tardó demasiado y lo detuve (puede que el juego tenga un ciclo infinito al cargar).' }); }, timeoutMs);
    hijo.stdout.on('data', (d) => { if (salida.length < 2 * 1024 * 1024) salida += d; });
    hijo.stderr.on('data', (d) => { if (err.length < 4000) err += d; });
    hijo.on('error', (e) => fin({ error: `No pude lanzar el análisis: ${e.message}` }));
    hijo.on('close', () => {
      try { fin({ resultado: JSON.parse(salida) }); }
      catch (_) { fin({ error: `El análisis no terminó bien.${err ? ` (${err.split('\n')[0].slice(0, 200)})` : ''}` }); }
    });
    hijo.stdin.on('error', () => {});
    hijo.stdin.end(JSON.stringify(payload));
  });
}

async function analizarAislado(html, opciones) {
  const r = await ejecutarAislado({ accion: 'analizar', html: String(html) }, opciones);
  return r.error ? { error: r.error } : { informe: r.resultado };
}

async function generarBoletoAislado(html, datos, opciones) {
  const r = await ejecutarAislado({ accion: 'boleto', html: String(html), ...datos }, opciones);
  return r.error ? { ok: false, error: r.error } : r.resultado;
}

module.exports = { analizar, generarBoleto, analizarAislado, generarBoletoAislado, aplicarArreglo, cambiarTag, ARREGLOS, mapearLlaves, TEST, firmaBot };

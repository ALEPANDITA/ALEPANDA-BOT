// Juegos del ARCADE definidos por "manifiesto": un par assets/arcade/juegos/<id>.html + <id>.json.
// Asi se pueden instalar juegos nuevos (con .crearcmd + un archivo .html) sin tocar el codigo del bot.
//
// El manifiesto describe, de forma declarativa (nada de codigo), como leer el boleto del juego, cuanto paga y que partidas
// son imposibles. Todo se valida estrictamente al cargar: un manifiesto malo se ignora, nunca tumba el arcade.
'use strict';

const fs = require('fs');
const path = require('path');

const CARPETA = path.join(__dirname, '..', 'assets', 'arcade', 'juegos');

const RE_ID = /^[a-z][a-z0-9]{1,15}$/;
const RE_TAG = /^[A-Z]{2,6}$/;
const RE_CMD = /^[a-z][a-z0-9]{1,19}$/;
const RE_CAMPO = /^[a-z][a-z0-9]{0,15}$/;
const RE_COEF = /^(?:(\d+(?:\.\d{1,2})?)\*)?\$moneda$/;
const MAX_HEX_TOTAL = 40;

const limpiarTexto = (t, max) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const esNumero = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;

// Coeficiente de premio: numero literal, "$moneda" (= valor de la moneda del arcade) o "3*$moneda"
function leerCoeficiente(c) {
  if (typeof c === 'number') return esNumero(c, 0, 1000000) ? { fijo: c, moneda: 0 } : null;
  if (typeof c === 'string') {
    const m = RE_COEF.exec(c.trim());
    if (!m) return null;
    const k = m[1] === undefined ? 1 : Number(m[1]);
    return esNumero(k, 0, 1000) ? { fijo: 0, moneda: k } : null;
  }
  return null;
}

// Devuelve { ok:true, limpio } o { ok:false, motivo }. `limpio` es una copia saneada, nunca el objeto original.
function validarManifiesto(m) {
  const no = (motivo) => ({ ok: false, motivo });
  if (!m || typeof m !== 'object' || Array.isArray(m)) return no('El manifiesto no es un objeto.');
  if (!RE_ID.test(String(m.id))) return no('id invalido (minusculas y numeros, 2 a 16, empieza con letra).');
  if (!RE_TAG.test(String(m.tag))) return no('tag invalido (2 a 6 letras MAYUSCULAS).');
  if (!Array.isArray(m.comandos) || !m.comandos.length || m.comandos.length > 4 || !m.comandos.every((c) => RE_CMD.test(String(c)))) {
    return no('comandos invalidos (1 a 4 nombres en minusculas/numeros).');
  }
  if (new Set(m.comandos).size !== m.comandos.length) return no('comandos repetidos.');
  if (!Array.isArray(m.campos) || !m.campos.length || m.campos.length > 12) return no('campos invalidos.');

  const campos = [];
  const nombres = new Set();
  let total = 0;
  for (const c of m.campos) {
    if (!c || typeof c !== 'object' || !RE_CAMPO.test(String(c.nombre)) || nombres.has(c.nombre)) return no('campo invalido o repetido.');
    if (!Number.isInteger(c.hex) || c.hex < 1 || c.hex > 8) return no(`campo ${c.nombre}: "hex" debe ser 1 a 8.`);
    nombres.add(c.nombre);
    total += c.hex;
    campos.push({
      nombre: c.nombre, hex: c.hex,
      texto: c.texto === true, // se queda como texto (nonce, relleno), no se convierte a numero
      etiqueta: limpiarTexto(c.etiqueta, 24) || null,
      icono: limpiarTexto(c.icono, 8) || null,
      oculto: c.oculto === true
    });
  }
  if (total < 6 || total > MAX_HEX_TOTAL) return no('el largo del boleto no es razonable.');
  if (!campos.some((c) => !c.texto)) return no('hace falta al menos un campo numerico.');

  const puntaje = String(m.puntaje || 'puntaje');
  const cp = campos.find((c) => c.nombre === puntaje && !c.texto);
  if (!cp) return no('el campo "puntaje" no existe o no es numerico.');

  const premio = {};
  const entradas = m.premio && typeof m.premio === 'object' ? Object.entries(m.premio) : [];
  for (const [k, v] of entradas) {
    if (k === 'constante') { if (!esNumero(v, 0, 1000000)) return no('premio.constante invalida.'); premio.constante = v; continue; }
    const campo = campos.find((c) => c.nombre === k && !c.texto);
    if (!campo) return no(`premio.${k}: ese campo no existe o no es numerico.`);
    if (!leerCoeficiente(v)) return no(`premio.${k}: valor invalido.`);
    premio[k] = v;
  }
  if (!Object.keys(premio).some((k) => k !== 'constante')) return no('el premio no depende de ningun campo.');

  const r = m.reglas && typeof m.reglas === 'object' ? m.reglas : {};
  const campoNum = (nombre) => campos.find((c) => c.nombre === nombre && !c.texto);
  const reglas = {};
  if (r.segundos != null) {
    if (!campoNum(r.segundos)) return no('reglas.segundos: el campo no existe.');
    reglas.segundos = r.segundos;
  }
  reglas.segundosBase = esNumero(r.segundosBase, 0, 600) ? r.segundosBase : 1;
  reglas.segundosPorPunto = esNumero(r.segundosPorPunto, 0, 600) ? r.segundosPorPunto : 0;
  reglas.conteo = (Array.isArray(r.conteo) ? r.conteo : [puntaje]).filter((n) => campoNum(n)).slice(0, 4);
  if (!reglas.conteo.length) reglas.conteo = [puntaje];
  reglas.maxPorSegundo = r.maxPorSegundo == null ? null : (esNumero(r.maxPorSegundo, 0.01, 100000) ? r.maxPorSegundo : null);
  reglas.maxPuntaje = r.maxPuntaje == null ? null : (esNumero(r.maxPuntaje, 1, 1e9) ? r.maxPuntaje : null);
  if (r.monedas != null) {
    if (!campoNum(r.monedas)) return no('reglas.monedas: el campo no existe.');
    reglas.monedas = r.monedas;
    reglas.monedasExtra = esNumero(r.monedasExtra, 0, 1000) ? r.monedasExtra : 1;
  }

  const rangos = (Array.isArray(m.rangos) ? m.rangos : [])
    .filter((x) => x && esNumero(x.min, 0, 1e9) && limpiarTexto(x.texto, 80))
    .map((x) => ({ min: x.min, texto: limpiarTexto(x.texto, 80) }))
    .sort((a, b) => b.min - a.min)
    .slice(0, 8);

  return {
    ok: true,
    limpio: {
      version: 1,
      id: m.id, tag: m.tag, comandos: [...m.comandos],
      titulo: limpiarTexto(m.titulo, 40) || m.id,
      emoji: limpiarTexto(m.emoji, 8) || '🎮',
      descripcion: limpiarTexto(m.descripcion, 140) || 'Juega, junta puntos y cóbralos en tu saldo.',
      unidad: limpiarTexto(m.unidad, 20) || 'puntos',
      campos, puntaje, premio, reglas, rangos
    }
  };
}

// Arma un "juego" con la misma forma que las entradas de CATALOGO de arcade.js
function construirJuego(m, rutaHtml) {
  const largoDatos = m.campos.reduce((a, c) => a + c.hex, 0);
  const coef = {};
  for (const [k, v] of Object.entries(m.premio)) if (k !== 'constante') coef[k] = leerCoeficiente(v);

  const r = m.reglas;
  return {
    id: m.id,
    tag: m.tag,
    archivo: path.basename(rutaHtml),
    ruta: rutaHtml,
    imagen: null,
    titulo: m.titulo,
    emoji: m.emoji,
    comandos: m.comandos,
    descripcion: m.descripcion,
    unidad: m.unidad,
    largoDatos,
    esExtra: true,
    manifiesto: m,

    decodificar(data) {
      const d = {};
      let i = 0;
      for (const c of m.campos) {
        const crudo = String(data).slice(i, i + c.hex);
        i += c.hex;
        d[c.nombre] = c.texto ? crudo : parseInt(crudo, 16);
      }
      return d;
    },

    validar(d) {
      const premioCrudo = Object.entries(coef).reduce((a, [k, c]) => a + ((c.fijo > 0 || c.moneda > 0) ? Math.max(0, d[k] || 0) : 0), 0);
      if (premioCrudo <= 0) return 'La partida no tiene premio.';
      if (r.monedas && d[r.monedas] > d[m.puntaje] + r.monedasExtra) return 'Monedas imposibles para ese puntaje.';
      if (r.maxPuntaje != null && d[m.puntaje] > r.maxPuntaje) return 'Puntaje imposible.';
      if (r.segundos) {
        const seg = d[r.segundos];
        const n = Math.max(...r.conteo.map((k) => d[k] || 0));
        if (r.segundosPorPunto > 0 && seg < r.segundosPorPunto * n + r.segundosBase) return 'Tiempo imposible para ese puntaje.';
        if (r.segundosPorPunto === 0 && seg < r.segundosBase) return 'Tiempo imposible para esa partida.';
        if (r.maxPorSegundo != null && n > r.maxPorSegundo * seg + 2) return 'Puntaje imposible para ese tiempo.';
      }
      return null;
    },

    premio(d, cfg) {
      let total = m.premio.constante || 0;
      for (const [k, c] of Object.entries(coef)) total += (d[k] || 0) * (c.fijo + c.moneda * cfg.valorMoneda);
      return Math.max(0, Math.floor(total));
    },

    resumen(d) {
      const partes = [];
      for (const c of m.campos) {
        if (c.texto || c.oculto) continue;
        if (r.segundos === c.nombre) partes.push(`⏱️ *${d[c.nombre]} s*`);
        else partes.push(`${c.icono ? `${c.icono} ` : ''}${c.etiqueta || c.nombre}: *${d[c.nombre]}*`);
      }
      return partes.join(' · ');
    },

    puntaje(d) { return d[m.puntaje]; },

    rango(d) {
      const p = d[m.puntaje];
      const f = m.rangos.find((x) => p >= x.min);
      return f ? f.texto : '🎮 ¡Buena partida! A seguir sumando.';
    }
  };
}

// ───────────── Carga con cache ─────────────
let cache = null; // { juegos, avisos }

// reservados: { ids:Set, tags:Set, comandos:Set } de lo que ya usa el catalogo propio del bot
function cargar(reservados) {
  if (cache) return cache;
  const juegos = [];
  const avisos = [];
  const ids = new Set(reservados.ids);
  const tags = new Set(reservados.tags);
  const cmds = new Set(reservados.comandos);
  let archivos = [];
  try { archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith('.json')).sort(); } catch (_) { archivos = []; }

  for (const f of archivos) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(CARPETA, f), 'utf8'));
      const v = validarManifiesto(m);
      if (!v.ok) { avisos.push(`${f}: ${v.motivo}`); continue; }
      const l = v.limpio;
      if (f !== `${l.id}.json`) { avisos.push(`${f}: el nombre del archivo debe ser ${l.id}.json`); continue; }
      const rutaHtml = path.join(CARPETA, `${l.id}.html`);
      if (!fs.existsSync(rutaHtml)) { avisos.push(`${f}: falta ${l.id}.html`); continue; }
      const choque = ids.has(l.id) ? `el id "${l.id}"` : (tags.has(l.tag) ? `el tag "${l.tag}"` : (l.comandos.find((c) => cmds.has(c)) ? `el comando "${l.comandos.find((c) => cmds.has(c))}"` : null));
      if (choque) { avisos.push(`${f}: ${choque} ya lo usa otro juego`); continue; }
      ids.add(l.id); tags.add(l.tag); l.comandos.forEach((c) => cmds.add(c));
      juegos.push(construirJuego(l, rutaHtml));
    } catch (err) {
      avisos.push(`${f}: ${err.message}`);
    }
  }
  for (const a of avisos) console.warn(`[arcade] juego ignorado -> ${a}`);
  cache = { juegos, avisos };
  return cache;
}

function listar(reservados) { return cargar(reservados).juegos; }
function avisos(reservados) { return cargar(reservados).avisos; }
function recargar() { cache = null; }

// ───────────── Instalar / quitar ─────────────
function escribirAtomico(ruta, contenido) {
  const tmp = `${ruta}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contenido);
  fs.renameSync(tmp, ruta);
}

// Escribe el .html y el .json del juego. Si algo falla, no deja medio juego instalado.
function instalar({ manifiesto, html, reservados, reemplazar = false }) {
  const v = validarManifiesto(manifiesto);
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const l = v.limpio;
  recargar();
  const otros = cargar(reservados).juegos.filter((j) => j.id !== l.id || !reemplazar);
  const choque = otros.find((j) => j.id === l.id || j.tag === l.tag || j.comandos.some((c) => l.comandos.includes(c)));
  if (choque) return { ok: false, motivo: `Choca con el juego "${choque.id}" (mismo id, tag o comando).` };
  if (reservados.ids.has(l.id) || reservados.tags.has(l.tag) || l.comandos.some((c) => reservados.comandos.has(c))) {
    return { ok: false, motivo: 'Choca con un juego propio del bot (mismo id, tag o comando).' };
  }
  if (typeof html !== 'string' || html.length < 200 || html.length > 3 * 1024 * 1024) return { ok: false, motivo: 'El HTML esta vacio o es demasiado grande.' };

  const rutaHtml = path.join(CARPETA, `${l.id}.html`);
  const rutaJson = path.join(CARPETA, `${l.id}.json`);
  try {
    fs.mkdirSync(CARPETA, { recursive: true });
    escribirAtomico(rutaHtml, html);
    escribirAtomico(rutaJson, JSON.stringify(l, null, 2));
  } catch (err) {
    try { fs.unlinkSync(rutaHtml); } catch (_) {}
    try { fs.unlinkSync(rutaJson); } catch (_) {}
    recargar();
    return { ok: false, motivo: `No pude escribir los archivos: ${err.message}` };
  }
  recargar();
  const juego = cargar(reservados).juegos.find((j) => j.id === l.id);
  if (!juego) {
    try { fs.unlinkSync(rutaHtml); } catch (_) {}
    try { fs.unlinkSync(rutaJson); } catch (_) {}
    recargar();
    return { ok: false, motivo: 'El juego no paso la validacion al cargarlo.' };
  }
  return { ok: true, juego };
}

// No borra: manda los archivos a juegos/_quitados/ por si el owner se arrepiente
function quitar(id, reservados) {
  const juego = cargar(reservados).juegos.find((j) => j.id === id);
  if (!juego) return { ok: false, motivo: 'Ese juego no esta instalado (o es uno propio del bot, que no se puede quitar).' };
  const destino = path.join(CARPETA, '_quitados');
  try {
    fs.mkdirSync(destino, { recursive: true });
    const sello = Date.now();
    fs.renameSync(path.join(CARPETA, `${id}.html`), path.join(destino, `${id}-${sello}.html`));
    fs.renameSync(path.join(CARPETA, `${id}.json`), path.join(destino, `${id}-${sello}.json`));
  } catch (err) {
    recargar();
    return { ok: false, motivo: `No pude mover los archivos: ${err.message}` };
  }
  recargar();
  return { ok: true, juego };
}

module.exports = { CARPETA, validarManifiesto, construirJuego, listar, avisos, recargar, instalar, quitar, leerCoeficiente, RE_ID, RE_TAG, RE_CMD };

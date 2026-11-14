// ARCADE: mini-juegos web (HTML) que se juegan en el navegador y pagan monedas al saldo del bot.
//
// Como funciona:
//   1) .flappy  -> el bot te da TU link personal (una "tarjeta" con id y secreto propios).
//   2) Juegas en la pagina. Al perder, la pagina arma un codigo firmado: FOX-<TARJETA>-<DATOS><FIRMA>
//   3) .reclamar FOX-...  -> el bot valida el codigo y suma las monedas a tu saldo ($).
//
// Para agregar OTRO juego del mismo estilo: poner su .html en assets/arcade/ y agregar una entrada en CATALOGO
// (tag del codigo, como leer los datos, que es "imposible", cuanto paga). Los comandos y la ruta web salen solos.
//
// Seguridad (honesta): el secreto viaja en el link y la pagina firma en el navegador, asi que un tramposo con ganas
// podria fabricarse codigos. Por eso el servidor NO confia ciegamente: la tarjeta es de una sola persona, cada codigo se
// cobra una sola vez, se descartan partidas imposibles (tiempo minimo por tuberia, monedas <= tuberias + 1), el tiempo
// jugado acumulado no puede pasar del tiempo real desde que se creo el link, y hay tope por cobro y por dia.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { leerDB, guardarDB, getUsuario } = require('./db');

const ARCHIVO = path.join(__dirname, '..', 'arcade-estado.json');
const ZONA = 'America/Tijuana';
const HORA = 3600 * 1000;

const DEFECTO = {
  modo: 'archivo',    // archivo = el bot manda el juego como archivo .html (se juega directo desde WhatsApp, sin servidor)
                      // link    = el bot manda un link a su mini servidor web (necesita puerto abierto)
  url: '',            // vacio = el bot detecta la IP publica (http://IP:puerto)
  puerto: 8787,
  nombreBot: 'ALEPANDA',
  valorMoneda: 250,   // lo que vale cada moneda de oro del juego
  maxPorCobro: 10000, // tope por cada .reclamar
  maxDiario: 100000,  // tope por persona y por dia
  vigenciaHoras: 24   // cuanto dura un link/tarjeta
};
const LIMITES = {
  puerto: [1024, 65535], valorMoneda: [1, 100000], maxPorCobro: [1, 10000000],
  maxDiario: [1, 100000000], vigenciaHoras: [1, 168]
};

// ───────────────────────── Catalogo de juegos ─────────────────────────
const CATALOGO = {
  flappy: {
    id: 'flappy',
    tag: 'FOX',
    archivo: 'flappy.html',
    imagen: 'flappy-preview.jpg', // tarjeta que sale al compartir el link en WhatsApp
    titulo: 'Flappy Fox',
    emoji: '🦊',
    comandos: ['flappy', 'flappyfox'],
    descripcion: 'Aletea, esquiva las tuberías y junta monedas de oro.',
    // DATOS (11 hex) = puntaje(2) + monedas(2) + segundos(3) + nonce(4)
    decodificar(data) {
      return {
        puntaje: parseInt(data.slice(0, 2), 16),
        monedas: parseInt(data.slice(2, 4), 16),
        segundos: parseInt(data.slice(4, 7), 16),
        nonce: data.slice(7, 11)
      };
    },
    // Motivo si la partida es imposible de jugar de verdad (null = ok).
    // Fisica del juego: una tuberia nueva cada 1.5 s, la primera tarda ~3.5 s en pasar; cada moneda va con una tuberia.
    validar(d) {
      if (d.puntaje <= 0 && d.monedas <= 0) return 'La partida no tiene premio.';
      if (d.monedas > d.puntaje + 1) return 'Monedas imposibles para esa cantidad de tuberias.';
      const n = Math.max(d.puntaje, d.monedas);
      if (d.segundos < 1.4 * n + 1) return 'Tiempo imposible para ese puntaje.';
      return null;
    },
    premio(d, cfg) { return d.puntaje * 1 + d.monedas * cfg.valorMoneda; },
    resumen(d) { return `🧱 Tuberías: *${d.puntaje}* · 🪙 Monedas: *${d.monedas}* · ⏱️ *${d.segundos} s*`; },
    puntaje(d) { return d.puntaje; },
    unidad: 'tuberías',
    // Frase de ranking segun lo bien que le fue
    rango(d) {
      if (d.puntaje >= 40) return '🏆 ¡LEYENDA DEL BAMBÚ! Nadie vuela como tú.';
      if (d.puntaje >= 25) return '🔥 ¡PANDAZO! Vuelo de campeón.';
      if (d.puntaje >= 12) return '💪 ¡Buen vuelo, guerrero!';
      if (d.puntaje >= 5) return '🐾 Nada mal, la manada te vio.';
      return '🎋 Calentando alas... ¡a seguir volando!';
    }
  }
};

function listarJuegos() { return Object.values(CATALOGO); }
function juegoPorTag(tag) { return listarJuegos().find((j) => j.tag === tag) || null; }
function juegoPorRuta(ruta) {
  const r = String(ruta || '').toLowerCase();
  return listarJuegos().find((j) => j.id === r || j.comandos.includes(r)) || null;
}

// ───────────────────────── Estado en disco ─────────────────────────
let estado = null;

function normalizarEstado(e) {
  const s = e && typeof e === 'object' ? e : {};
  s.config = { ...DEFECTO, ...(s.config || {}) };
  s.tarjetas = s.tarjetas && typeof s.tarjetas === 'object' ? s.tarjetas : {};
  s.porUsuario = s.porUsuario && typeof s.porUsuario === 'object' ? s.porUsuario : {};
  s.diario = s.diario && typeof s.diario === 'object' ? s.diario : {};
  s.stats = s.stats && typeof s.stats === 'object' ? s.stats : {};
  return s;
}

function cargar() {
  if (estado) return estado;
  let crudo = null;
  try {
    if (fs.existsSync(ARCHIVO)) crudo = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
  } catch (err) {
    try { fs.renameSync(ARCHIVO, `${ARCHIVO}.corrupto-${Date.now()}`); } catch (_) {}
    console.error('[arcade] arcade-estado.json estaba danado, lo aparte y empiezo limpio:', err.message);
  }
  estado = normalizarEstado(crudo);
  podar(Date.now());
  return estado;
}

function guardar() {
  if (!estado) return;
  try {
    const tmp = `${ARCHIVO}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
    fs.renameSync(tmp, ARCHIVO);
  } catch (err) {
    console.error('[arcade] no pude guardar el estado:', err.message);
  }
}

// Fuera tarjetas vencidas hace mas de 2 dias y referencias huerfanas
function podar(ahora) {
  const s = estado;
  for (const [id, t] of Object.entries(s.tarjetas)) {
    if (!t || !t.expira || ahora - t.expira > 48 * HORA) delete s.tarjetas[id];
  }
  for (const [k, id] of Object.entries(s.porUsuario)) {
    if (!s.tarjetas[id]) delete s.porUsuario[k];
  }
  const hoy = fechaDe(ahora);
  for (const [k, v] of Object.entries(s.diario)) {
    if (!v || v.fecha !== hoy) delete s.diario[k];
  }
}

function fechaDe(ms) {
  try { return new Date(ms).toLocaleDateString('en-CA', { timeZone: ZONA }); }
  catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}

// ───────────────────────── Configuracion ─────────────────────────
function leerConfigArcade() { return { ...cargar().config }; }

function cambiarConfig(clave, valor) {
  const s = cargar();
  if (clave === 'url') {
    const v = String(valor || '').trim();
    if (!v || v.toLowerCase() === 'auto') { s.config.url = ''; guardar(); return { ok: true, valor: '' }; }
    if (!/^https?:\/\/[^\s/?#]+(:\d+)?(\/[^\s?#]*)?$/i.test(v)) {
      return { ok: false, motivo: 'La URL debe verse asi: http://123.45.67.89:8787 o https://juegos.midominio.com' };
    }
    s.config.url = v.replace(/\/+$/, '');
    guardar();
    return { ok: true, valor: s.config.url };
  }
  if (clave === 'modo') {
    const v = String(valor || '').trim().toLowerCase();
    const m = /^(archivo|file|documento|html)$/.test(v) ? 'archivo' : (/^(link|enlace|web|url)$/.test(v) ? 'link' : null);
    if (!m) return { ok: false, motivo: 'El modo es "archivo" (se juega directo desde WhatsApp) o "link" (pagina web del bot).' };
    s.config.modo = m;
    guardar();
    return { ok: true, valor: m };
  }
  if (clave === 'nombreBot') {
    const v = String(valor || '').trim().slice(0, 24);
    if (!/^[\p{L}\p{N} ._-]{1,24}$/u.test(v)) return { ok: false, motivo: 'El nombre solo puede tener letras, numeros, espacios, punto, guion y guion bajo (max 24).' };
    s.config.nombreBot = v;
    guardar();
    return { ok: true, valor: v };
  }
  if (LIMITES[clave]) {
    const n = Number(String(valor).replace(/[,_ ]/g, ''));
    const [min, max] = LIMITES[clave];
    if (!Number.isInteger(n) || n < min || n > max) return { ok: false, motivo: `Ese valor tiene que ser un numero entero entre ${min} y ${max}.` };
    s.config[clave] = n;
    guardar();
    return { ok: true, valor: n };
  }
  return { ok: false, motivo: 'Opcion desconocida.' };
}

// ───────────────────────── Identidad ─────────────────────────
const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

// Lista de "numeros" que identifican a una persona (el de su JID y el de su LID si se pudo resolver)
function idsDe(...ids) {
  return [...new Set(ids.map(numeroDe).filter(Boolean))];
}

// ───────────────────────── Tarjetas (links personales) ─────────────────────────
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function textoAleatorio(longitud, alfabeto) {
  const bytes = crypto.randomBytes(longitud);
  let t = '';
  for (let i = 0; i < longitud; i++) t += alfabeto[bytes[i] % alfabeto.length];
  return t;
}

function crearTarjeta(juego, ids, ahora = Date.now()) {
  const s = cargar();
  podar(ahora);
  let id;
  do { id = textoAleatorio(6, ALFABETO); } while (s.tarjetas[id]);
  const t = {
    id,
    juego: juego.id,
    secreto: crypto.randomBytes(10).toString('hex'),
    ids: ids.slice(0, 4),
    creada: ahora,
    expira: ahora + s.config.vigenciaHoras * HORA,
    segundos: 0,
    usados: [],
    cobros: 0,
    total: 0
  };
  s.tarjetas[id] = t;
  for (const i of t.ids) s.porUsuario[`${juego.id}:${i}`] = id;
  guardar();
  return t;
}

// Reusa la tarjeta si todavia le queda mas de 1 hora de vida (asi el link que ya abriste sigue sirviendo)
function tarjetaActiva(juego, ids, ahora = Date.now()) {
  const s = cargar();
  for (const i of ids) {
    const t = s.tarjetas[s.porUsuario[`${juego.id}:${i}`]];
    if (t && t.juego === juego.id && t.expira - ahora > HORA) return t;
  }
  return null;
}

function obtenerTarjeta(juego, ids, { nueva = false, ahora = Date.now() } = {}) {
  if (!nueva) {
    const existente = tarjetaActiva(juego, ids, ahora);
    if (existente) {
      // Si ahora conocemos otro id de la misma persona, lo agregamos
      const faltan = ids.filter((i) => !existente.ids.includes(i));
      if (faltan.length) {
        existente.ids = [...existente.ids, ...faltan].slice(0, 4);
        for (const i of faltan) cargar().porUsuario[`${juego.id}:${i}`] = existente.id;
        guardar();
      }
      return { tarjeta: existente, nueva: false };
    }
  }
  return { tarjeta: crearTarjeta(juego, ids, ahora), nueva: true };
}

const CARPETA_ASSETS = path.join(__dirname, '..', 'assets', 'arcade');
const escaparHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// El juego como ARCHIVO .html ya personalizado (tarjeta, secreto, nombre del bot, prefijo y valor de moneda adentro).
// La pagina no hace ninguna llamada de red, asi que funciona abierta desde el chat sin servidor.
function htmlPersonalizado(juego, tarjeta, prefix = '.') {
  const cfg = cargar().config;
  const pre = /^[^A-Za-z0-9\s'"\\<>&]{1,3}$/.test(prefix) ? prefix : '.';
  const crudo = fs.readFileSync(path.join(CARPETA_ASSETS, path.basename(juego.archivo)), 'utf8');
  return crudo.split('\n').filter((l) => !/__OG_IMAGE__|og:image:/.test(l)).join('\n')
    .replace(/__BOT_NAME__/g, () => escaparHtml(cfg.nombreBot))
    .replace(/__CARD_ID__/g, () => tarjeta.id)
    .replace(/__CARD_SECRET__/g, () => tarjeta.secreto)
    .replace(/__COIN_VAL__/g, () => String(cfg.valorMoneda))
    .replace(/__PREFIX__/g, () => pre);
}

function enlaceRelativo(juego, tarjeta, prefix = '.') {
  const cfg = cargar().config;
  return `/${juego.id}?card=${tarjeta.id}&sec=${tarjeta.secreto}&p=${encodeURIComponent(prefix)}&v=${cfg.valorMoneda}`;
}

// ───────────────────────── Codigos ─────────────────────────
const RE_CODIGO = /([A-Z]{2,6})-([A-Z0-9]{6})-([0-9A-F]{11})([0-9A-F]{6})/;

function analizarCodigo(texto) {
  const m = RE_CODIGO.exec(String(texto || '').toUpperCase());
  if (!m) return null;
  return { codigo: m[0], tag: m[1], tarjeta: m[2], data: m[3], firma: m[4] };
}

function firmaDe(secreto, tarjetaId, data) {
  return crypto.createHmac('sha256', String(secreto)).update(`${tarjetaId}:${data}`).digest('hex').slice(0, 6).toUpperCase();
}

function firmaValida(secreto, tarjetaId, data, firma) {
  const esperada = Buffer.from(firmaDe(secreto, tarjetaId, data));
  const recibida = Buffer.from(String(firma));
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

// Anti-fuerza-bruta: 8 codigos malos en 10 minutos = pausa
const fallos = new Map();
const VENTANA_FALLOS = 10 * 60 * 1000;
const MAX_FALLOS = 8;

function fallosRecientes(clave, ahora) {
  const lista = (fallos.get(clave) || []).filter((t) => ahora - t < VENTANA_FALLOS);
  if (lista.length) fallos.set(clave, lista); else fallos.delete(clave);
  return lista;
}
function anotarFallo(clave, ahora) {
  const lista = fallosRecientes(clave, ahora);
  lista.push(ahora);
  fallos.set(clave, lista);
}

const fmt = (n) => Number(n).toLocaleString('es-MX');

// Todo lo de aqui adentro es sincrono (sin await) para que dos cobros al mismo tiempo no se pisen.
// ids: numeros que identifican a quien cobra. idPago: JID con el que se le paga (el mismo que usa .saldo en ese chat).
function reclamar({ texto, ids, idPago, nombre = null, ahora = Date.now() }) {
  const falla = (codigo, mensaje, cuenta = false) => {
    if (cuenta) anotarFallo(ids[0] || 'x', ahora);
    return { ok: false, codigo, mensaje };
  };

  const clave = ids[0] || 'x';
  if (fallosRecientes(clave, ahora).length >= MAX_FALLOS) {
    return falla('bloqueado', 'Demasiados códigos inválidos seguidos. Espera unos 10 minutos y vuelve a intentar.');
  }

  const partes = analizarCodigo(texto);
  if (!partes) return falla('formato', 'No encuentro un código válido. Debe verse así: FOX-ABC234-0A031B2C9D4E5F6A7B');

  const juego = juegoPorTag(partes.tag);
  if (!juego) return falla('juego', `No conozco el juego "${partes.tag}".`, true);

  const s = cargar();
  const cfg = s.config;
  const t = s.tarjetas[partes.tarjeta];
  if (!t || t.juego !== juego.id) return falla('tarjeta', 'Ese boleto no existe o ya se limpió. Genera tu link con el comando del juego y vuelve a jugar.', true);
  if (!ids.some((i) => t.ids.includes(i))) return falla('dueno', 'Ese boleto es de otra persona. Cada quien cobra solo sus propias partidas.', true);
  if (ahora > t.expira) return falla('vencida', 'Ese boleto ya venció. Genera un link nuevo con el comando del juego.');
  if (!firmaValida(t.secreto, t.id, partes.data, partes.firma)) return falla('firma', 'Código inválido (la firma no coincide). Cópialo completo desde la página del juego.', true);

  if (t.usados.includes(partes.data)) return falla('repetido', 'Ese código ya fue cobrado. Juega otra partida para ganar más.');

  const d = juego.decodificar(partes.data);
  const motivo = juego.validar(d);
  if (motivo) return falla('invalido', `Partida rechazada: ${motivo}`, true);

  // El tiempo jugado acumulado no puede ser mayor al tiempo que lleva existiendo el link
  const transcurrido = (ahora - t.creada) / 1000;
  if (t.segundos + d.segundos > transcurrido * 1.02 + 10) {
    return falla('tiempo', 'Partida rechazada: el tiempo jugado no cuadra con el tiempo real desde que abriste tu link.', true);
  }

  // Tope diario por persona
  const llave = t.ids[0];
  const hoy = fechaDe(ahora);
  const dia = s.diario[llave] && s.diario[llave].fecha === hoy ? s.diario[llave] : { fecha: hoy, total: 0 };
  const quedaHoy = cfg.maxDiario - dia.total;
  if (quedaHoy <= 0) {
    return falla('tope-diario', `Ya llegaste al tope de *$${fmt(cfg.maxDiario)}* ganados hoy en el arcade. Tu código sigue guardado mientras el boleto no venza; vuelve mañana.`);
  }

  let premio = juego.premio(d, cfg);
  let recortado = null;
  if (premio > cfg.maxPorCobro) { premio = cfg.maxPorCobro; recortado = 'por cobro'; }
  if (premio > quedaHoy) { premio = quedaHoy; recortado = 'diario'; }
  if (premio <= 0) return falla('invalido', 'Esa partida no deja premio.');

  // Pagar: se marca el codigo, se paga, se guarda. Si el pago falla se deshace la marca.
  t.usados.push(partes.data);
  const db = leerDB();
  const usuario = getUsuario(db, idPago);
  const saldoAntes = usuario.saldo;
  try {
    usuario.saldo = saldoAntes + premio;
    guardarDB(db);
  } catch (err) {
    t.usados.pop();
    console.error('[arcade] no pude pagar:', err.message);
    return falla('error', 'No pude guardar tu premio, intenta de nuevo en un momento.');
  }

  if (t.usados.length > 2000) t.usados = t.usados.slice(-2000);
  t.segundos += d.segundos;
  t.cobros += 1;
  t.total += premio;
  dia.total += premio;
  s.diario[llave] = dia;
  const st = s.stats[llave] || (s.stats[llave] = { nombre: null, jid: idPago, total: 0, partidas: 0, mejor: {} });
  const mejorAntes = st.mejor[juego.id] || 0;
  st.jid = idPago;
  if (nombre) st.nombre = String(nombre).slice(0, 40);
  st.total += premio;
  st.partidas += 1;
  const pj = juego.puntaje(d);
  if (!st.mejor[juego.id] || pj > st.mejor[juego.id]) st.mejor[juego.id] = pj;
  guardar();

  const puesto = top(juego, 100000).findIndex((f) => f.llave === llave) + 1;
  return {
    ok: true, juego, datos: d, premio, recortado, saldo: usuario.saldo,
    restanteHoy: Math.max(0, cfg.maxDiario - dia.total),
    nuevoRecord: pj > mejorAntes && mejorAntes > 0, primerRecord: mejorAntes === 0, mejor: st.mejor[juego.id], puesto
  };
}

// Ranking por mejor puntaje de un juego
function top(juego, limite = 10) {
  const s = cargar();
  return Object.entries(s.stats)
    .filter(([, v]) => v && v.mejor && v.mejor[juego.id] > 0)
    .map(([llave, v]) => ({ llave, nombre: v.nombre, jid: v.jid, mejor: v.mejor[juego.id], partidas: v.partidas, total: v.total }))
    .sort((a, b) => b.mejor - a.mejor || b.total - a.total)
    .slice(0, limite);
}

function resumenEstado() {
  const s = cargar();
  const ahora = Date.now();
  const vivas = Object.values(s.tarjetas).filter((t) => t.expira > ahora);
  return { tarjetasVivas: vivas.length, jugadores: Object.keys(s.stats).length, config: { ...s.config } };
}

module.exports = {
  CATALOGO, listarJuegos, juegoPorTag, juegoPorRuta,
  leerConfigArcade, cambiarConfig, idsDe, numeroDe,
  obtenerTarjeta, enlaceRelativo, htmlPersonalizado, analizarCodigo, firmaDe, reclamar, top, resumenEstado,
  // para pruebas
  _reiniciarMemoria() { estado = null; fallos.clear(); },
  ARCHIVO
};

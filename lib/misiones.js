// MISIONES: cada persona recibe 5 misiones que duran 24 horas y se ajustan a cuánto dinero puede juntar (por sus negocios).
// Al completar 5 misiones (en total) sus negocios dan un multiplicador extra por unas horas (aparte del x1.5 de pareja).
// El avance se mide solo: index.js envuelve cada comando de economía/casino con medir() y compara el dinero antes y después.
const { leerDB, guardarDB, getUsuario } = require('./db');
const N = require('./eco-negocios');
const { exito } = require('./estilo');

const DURACION = 24 * 3600000;
const CADA = 5;              // cada 5 misiones completadas...
const MULT_PREMIO = 1.5;     // ...x1.5 en todos los negocios...
const HORAS_PREMIO = 3;      // ...durante 3 horas
const PISO = 1500;           // capacidad mínima para calcular metas (gente sin negocios)

const GANAN = new Set(['recolectar', 'trabajar', 'crimen', 'slut', 'minar', 'pescar', 'talar', 'cazar', 'explorar', 'taxi', 'streamear', 'diario', 'semanal', 'mensual', 'robar', 'atraco', 'invertir', 'matematicas', 'aventura', 'buceo', 'cofre']);
const TRABAJOS = new Set(['trabajar', 'crimen', 'slut', 'minar', 'pescar', 'talar', 'cazar', 'explorar', 'taxi', 'streamear']);
const APUESTAS = new Set(['apostar', 'baccarat', 'blackjack', 'crash', 'dados', 'duelodados', 'fortuna', 'keno', 'loteria', 'moneda', 'plinko', 'raspadito', 'ruleta', 'ruletanimal', 'ruletarusa', 'sicbo', 'tragamonedas', 'carrera', 'cartas']);
const OMITIR = new Set(['transferir', 'regalar', 'darmoney', 'quitarmoney', 'trasladar', 'prestamo', 'banco', 'retirar']);

const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const barra = (p) => { const n = Math.round(Math.max(0, Math.min(1, p)) * 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); };
const tiempo = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const redondo = (x) => { // metas "bonitas"
  x = Math.max(1, Math.round(x));
  const e = Math.pow(10, Math.max(0, String(x).length - 2));
  return Math.max(1, Math.round(x / e) * e);
};

// Catálogo. meta(cap) = lo que hay que lograr; premio(cap) = lo que paga
const TIPOS = {
  ganar:    { icono: '💰', texto: (m) => `Junta ${dinero(m)} en 24 horas (trabajos, negocios, casino...)`, meta: (c) => redondo(Math.max(1000, c * 0.6)) },
  apostar:  { icono: '🎰', texto: (m) => `Apuesta ${dinero(m)} en el casino`, meta: (c) => redondo(Math.max(2000, c * 0.35)) },
  cobrar:   { icono: '📦', texto: (m) => `Cobra ${dinero(m)} de tus negocios con recolectar`, meta: (c) => redondo(Math.max(800, c * 0.4)) },
  trabajos: { icono: '⛏️', texto: (m) => `Haz ${m} trabajos (trabajar, minar, pescar, talar, cazar...)`, meta: () => 6 },
  victorias:{ icono: '🏆', texto: (m) => `Gana ${m} juegos del casino`, meta: () => 3 },
  jugadas:  { icono: '🎲', texto: (m) => `Juega ${m} veces en el casino`, meta: () => 10 },
  ahorrar:  { icono: '🏦', texto: (m) => `Deposita ${dinero(m)} en el banco`, meta: (c) => redondo(Math.max(500, c * 0.25)) }
};
const ALEATORIAS = ['cobrar', 'trabajos', 'victorias', 'jugadas', 'ahorrar'];
const esDinero = (t) => ['ganar', 'apostar', 'cobrar', 'ahorrar'].includes(t);
const premioDe = (cap) => redondo(Math.max(300, cap * 0.12));

function capacidad(db, u, ahora) {
  const r = N.resumen(u, db, ahora);
  return Math.max(PISO, Math.floor((r.base || 0) * N.MAX_HORAS)); // sin multiplicadores temporales
}

function nuevoSet(db, u, ahora) {
  const cap = capacidad(db, u, ahora);
  const mezcla = ALEATORIAS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const tipos = ['ganar', 'apostar', ...mezcla];
  return {
    asignada: ahora, expira: ahora + DURACION, cap,
    lista: tipos.map((t) => ({ t, meta: TIPOS[t].meta(cap), prog: 0, hecha: false, premio: premioDe(cap) }))
  };
}

// Devuelve las misiones activas de la persona (las crea si no tiene o ya vencieron). Modifica u; guarda quien llama.
function asegurar(db, u, ahora = Date.now()) {
  const m = u.misiones;
  if (!m || !Array.isArray(m.lista) || m.expira <= ahora) { u.misiones = nuevoSet(db, u, ahora); return { nuevas: true, set: u.misiones }; }
  return { nuevas: false, set: m };
}

// Suma el avance de un evento. ev = { gano, apostado, gasto (casino), victoria, jugada, trabajo, cobro, deposito }
function avanzar(set, ev) {
  const hechas = [];
  for (const q of set.lista) {
    if (q.hecha) continue;
    let suma = 0;
    if (q.t === 'ganar') suma = ev.gano || 0;
    else if (q.t === 'apostar') suma = ev.apostado || 0;
    else if (q.t === 'cobrar') suma = ev.cobro || 0;
    else if (q.t === 'trabajos') suma = ev.trabajo ? 1 : 0;
    else if (q.t === 'victorias') suma = ev.victoria ? 1 : 0;
    else if (q.t === 'jugadas') suma = ev.jugada ? 1 : 0;
    else if (q.t === 'ahorrar') suma = ev.deposito || 0;
    if (!suma) continue;
    q.prog = Math.min(q.meta, (Number(q.prog) || 0) + suma);
    if (q.prog >= q.meta) { q.hecha = true; hechas.push(q); }
  }
  return hechas;
}

// Paga lo completado y da el multiplicador cada CADA misiones. Devuelve lo que hay que avisar.
function cobrarPremios(db, u, hechas, ahora) {
  let dinero_ = 0;
  let boosts = 0;
  for (const q of hechas) {
    dinero_ += Number(q.premio) || 0;
    u.misionesTotal = (Number(u.misionesTotal) || 0) + 1;
    if (u.misionesTotal % CADA === 0) boosts += 1;
  }
  if (dinero_) u.saldo = (Number(u.saldo) || 0) + dinero_;
  let hasta = 0;
  for (let i = 0; i < boosts; i++) {
    N.podarMult(u, ahora);
    const lista = Array.isArray(u.multiplicadores) ? u.multiplicadores : (u.multiplicadores = []);
    const previo = lista.filter((e) => e.fuente === 'misiones').reduce((t, e) => Math.max(t, e.hasta), 0);
    const desde = Math.max(ahora, previo);
    hasta = desde + HORAS_PREMIO * 3600000;
    lista.push({ mult: MULT_PREMIO, desde, hasta, fuente: 'misiones' });
  }
  return { dinero: dinero_, boosts, hasta };
}

function textoMision(q) {
  const T = TIPOS[q.t];
  const prog = esDinero(q.t) ? `${dinero(q.prog)} / ${dinero(q.meta)}` : `${q.prog} / ${q.meta}`;
  return [`${q.hecha ? '✅' : T.icono} ${T.texto(q.meta)}`, `   ${barra(q.prog / q.meta)} ${prog} · premio ${dinero(q.premio)}`];
}

function panel(db, u, ahora = Date.now()) {
  const { set } = asegurar(db, u, ahora);
  const hechas = set.lista.filter((q) => q.hecha).length;
  const total = Number(u.misionesTotal) || 0;
  const faltan = CADA - (total % CADA);
  const r = N.resumen(u, db, ahora);
  const l = [`⏳ Se renuevan en ${tiempo(set.expira - ahora)} · hoy: ${hechas}/${set.lista.length}`, ''];
  for (const q of set.lista) l.push(...textoMision(q), '');
  l.push(`🎁 Cada ${CADA} misiones completadas tus negocios dan *x${MULT_PREMIO}* por ${HORAS_PREMIO} horas (aparte del x${N.BONO_PAREJA} de pareja).`);
  l.push(`   ${barra((total % CADA) / CADA)} ${total % CADA}/${CADA} · te faltan ${faltan} · llevas ${total} en total`);
  if (r.mult > 1) l.push('', `⚡ Multiplicador activo: *x${Math.round(r.mult * 100) / 100}* · quedan ${tiempo(r.multHasta - ahora)}`);
  return l;
}

// ---- gancho en index.js ----
const aplica = (c) => c && (c.category === 'economia' || c.category === 'casino') && !OMITIR.has(c.name);
const remitenteDe = (msg) => msg.key.participant || msg.key.remoteJid;
function foto(msg) {
  const db = leerDB();
  const u = getUsuario(db, remitenteDe(msg));
  return { saldo: Number(u.saldo) || 0, banco: Number(u.banco) || 0 };
}

function leerApuesta(texto, saldoAntes) {
  const t = String(texto || '').trim().split(/\s+/).slice(1);
  for (const p of t) {
    const q = p.toLowerCase();
    if (q === 'all' || q === 'todo') return saldoAntes;
    if (/^\d+$/.test(p) && Number(p) >= 1) return Math.min(Number(p), saldoAntes);
  }
  return 0;
}

async function medir(sock, jid, msg, comando, texto, ejecutar) {
  let antes = null;
  try { if (aplica(comando)) antes = foto(msg); } catch (e) { antes = null; }
  await ejecutar();
  if (!antes) return;
  try { await despues(sock, jid, msg, comando, texto, antes); } catch (e) { console.error('[misiones]', e.message); }
}

async function despues(sock, jid, msg, comando, texto, antes) {
  const nombre = comando.name;
  const db = leerDB();
  const remitente = remitenteDe(msg);
  const u = getUsuario(db, remitente);
  const d = (Number(u.saldo) || 0) - antes.saldo;
  const dBanco = (Number(u.banco) || 0) - antes.banco;
  const ev = {};
  if (APUESTAS.has(nombre) && d !== 0) {
    const apuesta = leerApuesta(texto, antes.saldo) || Math.abs(d);
    ev.apostado = apuesta; ev.jugada = true;
    if (d > 0) ev.victoria = true;
  }
  if ((GANAN.has(nombre) || APUESTAS.has(nombre)) && d > 0) ev.gano = d;
  if (nombre === 'recolectar' && d > 0) ev.cobro = d;
  if (TRABAJOS.has(nombre) && d > 0) ev.trabajo = true;
  if (nombre === 'depositar' && dBanco > 0 && d < 0) ev.deposito = Math.min(dBanco, -d);
  if (!Object.keys(ev).length) return;

  const ahora = Date.now();
  const { set } = asegurar(db, u, ahora);
  const hechas = avanzar(set, ev);
  const pago = hechas.length ? cobrarPremios(db, u, hechas, ahora) : null;
  guardarDB(db);
  if (!hechas.length) return;

  const lineas = hechas.map((q) => `🎯 ${TIPOS[q.t].texto(q.meta)}\n   🎁 +${dinero(q.premio)}`);
  if (pago.boosts) lineas.push('', `⚡ ¡Completaste ${CADA} misiones! Tus negocios dan *x${MULT_PREMIO}* durante ${HORAS_PREMIO} horas.`);
  const hoy = set.lista.filter((q) => q.hecha).length;
  lineas.push('', `📋 Misiones de hoy: ${hoy}/${set.lista.length}`);
  await sock.sendMessage(jid, { text: exito(lineas.join('\n'), { titulo: 'MISIÓN COMPLETADA', estilo: 'neon' }), mentions: [remitente] }, { quoted: msg });
}

module.exports = { medir, panel, asegurar, avanzar, cobrarPremios, nuevoSet, despues, aplica, TIPOS, CADA, MULT_PREMIO, HORAS_PREMIO, dinero, tiempo };

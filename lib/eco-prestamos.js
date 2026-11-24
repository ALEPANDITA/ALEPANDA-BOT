// Préstamos del Banco Alepanda: el límite depende de tus negocios (valor + mejoras + lo que generan por hora) y de tu historial.
const N = require('./eco-negocios');

const DIA = 864e5, HORA = 36e5;
const GRACIA = 24 * HORA;      // tras vencer, el banco espera 24 h antes del primer embargo
const AVISO_ANTES = 6 * HORA;  // aviso previo a cada embargo
const CADA_EMBARGO = 24 * HORA; // un negocio cada 24 h mientras no pagues
const PRORROGA = 2 * DIA;      // días extra si abonas la mitad
const RECARGO_RECUPERAR = 0.15;
const CREDITO_EMBARGO = 0.4;   // el banco "vende" el negocio y abona el 40% de su valor a tu deuda
const VIGENCIA = 7 * DIA;      // tiempo para recuperar un negocio embargado
const FACTOR_ACTIVOS = 0.25; // te prestan el 25% del valor de tus negocios
const HORAS_INGRESO = 6;     // + 6 horas de lo que generan
const BASE = 2000;           // crédito mínimo para quien empieza
const MORA_DIA = 0.05;       // recargo por cada día de atraso (sobre lo prestado)
const MORA_MAX = 0.5;
const PLANES = [
  { id: 1, nombre: 'Básico', parte: 0.25, interes: 0.06, dias: 3, icono: '🥉' },
  { id: 2, nombre: 'Plus', parte: 0.5, interes: 0.08, dias: 4, icono: '🥈' },
  { id: 3, nombre: 'Premium', parte: 1, interes: 0.10, dias: 5, icono: '🥇' }
];

const redondear = (n) => (n >= 1e4 ? Math.floor(n / 1000) * 1000 : Math.floor(n / 100) * 100);

// Solo cuentan los negocios que son tuyos (no los de tu pareja) para no prestar dos veces por lo mismo
function activos(u) {
  let valor = 0, hora = 0, cantidad = 0, mejoras = 0;
  for (const id of N.propios(u)) {
    const n = N.POR_ID[id];
    const nv = N.nivelDe(u, id);
    valor += n.precio;
    for (let i = 1; i <= nv; i++) valor += n.etapas[i].costo;
    hora += n.etapas[nv].hora;
    mejoras += nv;
    cantidad++;
  }
  return { valor, hora, cantidad, mejoras };
}

function historial(u) {
  const pagados = Number(u.prestamosPagados) || 0;
  const moras = Number(u.prestamosMora) || 0;
  const mult = Math.max(0.5, Math.min(1.4, 1 + 0.04 * pagados - 0.15 * moras));
  return { pagados, moras, mult };
}

function limite(u) {
  const a = activos(u);
  const h = historial(u);
  return { ...a, ...h, limite: redondear((BASE + a.valor * FACTOR_ACTIVOS + a.hora * HORAS_INGRESO) * h.mult) };
}

function calificacion(lim, moras) {
  const l = lim >= 1e9 ? 'AAA' : lim >= 1e8 ? 'AA' : lim >= 1e7 ? 'A' : lim >= 1e6 ? 'BBB' : lim >= 1e5 ? 'BB' : lim >= 1e4 ? 'B' : 'C';
  return l + (moras > 0 ? ' ⚠️' : '');
}

// Estado de la deuda ahora mismo (o null si no debes nada)
function estado(u, ahora = Date.now()) {
  const p = u.prestamo;
  if (!p || typeof p !== 'object') return null;
  const atraso = Math.max(0, ahora - p.vence);
  const dias = Math.ceil(atraso / 864e5);
  const mora = atraso > 0 ? Math.round(Math.min(MORA_MAX, dias * MORA_DIA) * p.monto) : 0;
  const debe = Math.max(0, Math.ceil(p.total + mora - (p.pagado || 0)));
  return { ...p, atraso: atraso > 0, dias, mora, debe, restante: Math.max(0, p.vence - ahora) };
}

function cerrar(u, conMora) {
  if (conMora) u.prestamosMora = (Number(u.prestamosMora) || 0) + 1;
  else u.prestamosPagados = (Number(u.prestamosPagados) || 0) + 1;
  delete u.prestamo;
}

function ofertas(u) {
  const l = limite(u).limite;
  return PLANES.map((p) => {
    const monto = redondear(l * p.parte);
    return { ...p, monto, total: Math.ceil(monto * (1 + p.interes)) };
  }).filter((o) => o.monto >= 500);
}

function pedir(u, entrada, ahora = Date.now(), jid = null) {
  if (u.prestamo) return { error: 'deuda' };
  const lim = limite(u).limite;
  const ofs = ofertas(u);
  let plan, monto;
  const t = String(entrada || '').toLowerCase().replace(/[,._$]/g, '');
  if (/^[123]$/.test(t)) { plan = ofs.find((o) => o.id === Number(t)); if (!plan) return { error: 'poco', lim }; monto = plan.monto; }
  else if (['max', 'todo', 'maximo', 'máximo'].includes(t)) { monto = redondear(lim); }
  else if (/^\d+$/.test(t)) { monto = parseInt(t, 10); }
  else return { error: 'uso' };
  if (monto < 500 || lim < 500) return { error: 'poco', lim };
  if (monto > lim) return { error: 'limite', lim, monto };
  if (!plan) plan = PLANES.slice().reverse().find((p) => monto <= lim * p.parte + 0.5) || PLANES[2];
  const total = Math.ceil(monto * (1 + plan.interes));
  u.saldo = (u.saldo || 0) + monto;
  u.prestamo = { monto, interes: plan.interes, plan: plan.nombre, total, pagado: 0, pedido: ahora, vence: ahora + plan.dias * DIA, jid, avisos: {} };
  return { monto, total, plan, interes: total - monto, vence: u.prestamo.vence, dias: plan.dias };
}

function pagar(u, entrada, ahora = Date.now()) {
  const e = estado(u, ahora);
  if (!e) return { error: 'sin' };
  const mano = Math.floor(u.saldo || 0), banco = Math.floor(u.banco || 0);
  const t = String(entrada || '').toLowerCase().replace(/[,._$]/g, '');
  let monto;
  if (!t || ['todo', 'all', 'total'].includes(t)) monto = e.debe;
  else if (t === 'mitad') monto = Math.ceil(e.debe / 2);
  else if (/^\d+$/.test(t)) monto = parseInt(t, 10);
  else return { error: 'uso' };
  monto = Math.min(monto, e.debe);
  if (monto <= 0) return { error: 'uso' };
  if (mano + banco < monto) return { error: 'fondos', mano, banco, monto };
  let falta = monto;
  const deMano = Math.min(falta, mano); u.saldo -= deMano; falta -= deMano;
  const deBanco = Math.min(falta, banco); u.banco -= deBanco;
  const p = u.prestamo;
  p.pagado = (p.pagado || 0) + monto;
  const fin = estado(u, ahora);
  const saldada = fin.debe <= 0;
  const conMora = !!p.hubo || e.atraso;
  let prorrogada = false;
  if (saldada) cerrar(u, conMora);
  else if (!p.prorroga && monto >= Math.ceil(e.debe / 2)) {
    // abonó la mitad: se queda el recargo ya generado y se dan 2 días más
    p.total += e.mora;
    p.vence = Math.max(p.vence, ahora) + PRORROGA;
    p.avisos = {}; p.proxEmb = null; p.prorroga = 1; prorrogada = true;
  }
  return { monto, deMano, deBanco, debe: fin.debe, saldada, conMora, prorrogada, vence: u.prestamo ? u.prestamo.vence : null };
}


// ---- Embargos: el banco retira negocios de uno en uno si no pagas ----
function valorNegocio(u, id) {
  const n = N.POR_ID[id];
  let v = n.precio;
  for (let i = 1; i <= N.nivelDe(u, id); i++) v += n.etapas[i].costo;
  return v;
}

function purgar(u, ahora) {
  if (!Array.isArray(u.embargos)) return;
  u.embargos = u.embargos.filter((x) => x && N.POR_ID[x.id] && x.hasta > ahora);
  if (!u.embargos.length) u.embargoCont = 0;
}

// Quita un negocio. Las exclusivas (únicas del bot) están protegidas. Devuelve el evento a avisar o null si no queda nada que quitar.
function embargarUno(db, u, ahora) {
  const e = estado(u, ahora);
  const pool = N.propios(u).map((id) => N.POR_ID[id]).filter((n) => n.tipo !== 'exclusiva')
    .map((n) => ({ n, cred: Math.round(valorNegocio(u, n.id) * CREDITO_EMBARGO) }));
  if (!pool.length) return null;
  let cand = pool.filter((x) => x.cred <= e.debe);
  if (!cand.length) { const m = Math.min(...pool.map((x) => x.cred)); cand = pool.filter((x) => x.cred === m); }
  const el = cand[Math.floor(Math.random() * cand.length)];
  N.fijar(db, u, ahora);
  const nivel = N.nivelDe(u, el.n.id);
  u.negocios = N.propios(u).filter((id) => id !== el.n.id);
  if (u.negocioNiveles) delete u.negocioNiveles[el.n.id];
  const aplicado = Math.min(el.cred, e.debe);
  const exceso = el.cred - aplicado;
  u.prestamo.pagado = (u.prestamo.pagado || 0) + aplicado;
  if (exceso > 0) u.banco = (u.banco || 0) + exceso;
  if (!Array.isArray(u.embargos)) u.embargos = [];
  u.embargoCont = (Number(u.embargoCont) || 0) + 1;
  let perdidos = [];
  if (u.embargoCont >= 3) { perdidos = u.embargos.map((x) => N.POR_ID[x.id]).filter(Boolean); u.embargos = []; u.embargoCont = 1; }
  u.embargos.push({ id: el.n.id, nivel, credito: el.cred, ts: ahora, hasta: ahora + VIGENCIA });
  const fin = estado(u, ahora);
  const cerrada = fin.debe <= 0;
  if (cerrada) cerrar(u, true);
  else { u.prestamo.proxEmb = ahora + CADA_EMBARGO; u.prestamo.avisos.adv = 0; }
  return { tipo: 'embargo', n: el.n, credito: el.cred, aplicado, exceso, perdidos, debe: fin.debe, cerrada, costo: Math.ceil(el.cred * (1 + RECARGO_RECUPERAR)), restantes: N.propios(u).length };
}

// Avanza el préstamo según el reloj y devuelve los avisos que toca dar (cada uno sale una sola vez)
function procesar(db, u, ahora = Date.now()) {
  purgar(u, ahora);
  const p = u.prestamo;
  const ev = [];
  if (!p || typeof p !== 'object') return ev;
  if (!p.avisos) p.avisos = {};
  const e = estado(u, ahora);
  if (e.debe <= 0) { cerrar(u, !!p.hubo); return ev; }
  if (ahora < p.vence) {
    if (!p.avisos.pre && p.vence - ahora <= DIA) { p.avisos.pre = 1; ev.push({ tipo: 'pre' }); }
    return ev;
  }
  p.hubo = 1;
  if (!p.avisos.venc) { p.avisos.venc = 1; ev.push({ tipo: 'venc' }); }
  if (!p.proxEmb) p.proxEmb = Math.max(p.vence + GRACIA, ahora + AVISO_ANTES);
  if (ahora >= p.proxEmb) {
    const r = embargarUno(db, u, ahora);
    if (r) ev.push(r);
    else if (u.prestamo) { u.prestamo.proxEmb = ahora + CADA_EMBARGO; if (!u.prestamo.avisos.sin) { u.prestamo.avisos.sin = 1; ev.push({ tipo: 'sin' }); } }
  } else if (!p.avisos.adv && p.proxEmb - ahora <= AVISO_ANTES) {
    p.avisos.adv = 1; ev.push({ tipo: 'adv' });
  }
  return ev;
}

function embargosDe(u, ahora = Date.now()) {
  purgar(u, ahora);
  return (u.embargos || []).map((x, i) => {
    const n = N.POR_ID[x.id];
    return { num: i + 1, id: x.id, emoji: n.emoji, nombre: n.etapas[Math.min(x.nivel, n.maxNivel)].nombre, nivel: x.nivel, costo: Math.ceil(x.credito * (1 + RECARGO_RECUPERAR)), restante: x.hasta - ahora };
  });
}

function recuperar(db, u, entrada, ahora = Date.now()) {
  const lista = embargosDe(u, ahora);
  if (!lista.length) return { error: 'nada' };
  const num = parseInt(String(entrada || '').replace(/\D/g, ''), 10);
  const sel = lista.find((x) => x.num === num) || (lista.length === 1 && !entrada ? lista[0] : null);
  if (!sel) return { error: 'cual', lista };
  const mano = Math.floor(u.saldo || 0), banco = Math.floor(u.banco || 0);
  if (N.propios(u).includes(sel.id)) {
    u.embargos = u.embargos.filter((x) => x.id !== sel.id);
    return { error: 'ya', sel };
  }
  if (mano + banco < sel.costo) return { error: 'fondos', sel, mano, banco };
  const deMano = Math.min(sel.costo, mano);
  u.saldo = mano - deMano;
  u.banco = banco - (sel.costo - deMano);
  N.fijar(db, u, ahora);
  const reg = u.embargos.find((x) => x.id === sel.id);
  u.negocios = [...N.propios(u), sel.id];
  if (reg.nivel > 0) u.negocioNiveles = { ...(u.negocioNiveles || {}), [sel.id]: reg.nivel };
  u.embargos = u.embargos.filter((x) => x.id !== sel.id);
  return { sel, deMano, deBanco: sel.costo - deMano };
}

// ---- Textos de los avisos ----
const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const cuando = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`; };
const CAB = ['🏦 *B A N C O   A L E P A N D A* 🏦', '✦ Aviso del banco', '━━━━━━━━━━━━━━━━━━━━'];

function textoEvento(ev, u, quien, prefix = '.', ahora = Date.now()) {
  const e = estado(u, ahora);
  const mitad = e ? Math.ceil(e.debe / 2) : 0;
  const opciones = e ? [
    `1️⃣ Pagar todo: *${prefix}banco pagar todo*  (${dinero(e.debe)})`,
    `2️⃣ Abonar la mitad: *${prefix}banco pagar mitad*  (${dinero(mitad)})`,
    ...(!u.prestamo.prorroga ? ['      ↳ ¡y te damos *2 días extra*!'] : [])
  ] : [];
  let t;
  if (ev.tipo === 'pre') t = ['⏰ *AVISO DE PAGO*', '', `${quien}, tu préstamo vence en *${cuando(e.restante)}*.`, `💸 Debes: *${dinero(e.debe)}*`, '', ...opciones];
  else if (ev.tipo === 'venc') t = ['🚨 *PRÉSTAMO VENCIDO*', '', `${quien}, ya pasó tu fecha de pago.`, `💸 Debes: *${dinero(e.debe)}*${e.mora ? ` (incluye recargo ${dinero(e.mora)})` : ''}`, '', ...opciones, '', `⚠️ Si no haces nada, en *${cuando(Math.max(0, (u.prestamo.proxEmb || ahora) - ahora))}* el banco te retirará un negocio.`];
  else if (ev.tipo === 'adv') t = ['⚠️ *ÚLTIMO AVISO*', '', `${quien}, en *${cuando(Math.max(0, u.prestamo.proxEmb - ahora))}* el banco te quitará uno de tus negocios.`, `💸 Debes: *${dinero(e.debe)}*`, '', ...opciones];
  else if (ev.tipo === 'sin') t = ['🏚️ *SIN NEGOCIOS QUE EMBARGAR*', '', `${quien}, ya no tienes negocios para que el banco cobre.`, `💸 Sigues debiendo *${dinero(e.debe)}* y el recargo sigue creciendo.`, `Paga con *${prefix}banco pagar <monto>*`];
  else if (ev.tipo === 'embargo') {
    t = ['🏚️ *EMBARGO DEL BANCO*', '', `${quien}, el banco retiró *${ev.n.emoji} ${ev.n.nombre}* de tu posición. Ahora es del banco.`, `🧾 Se abonaron *${dinero(ev.aplicado)}* a tu deuda${ev.exceso ? ` y se te devolvieron ${dinero(ev.exceso)} en tu banco` : ''}.`];
    if (ev.cerrada) t.push('✅ Con eso tu deuda quedó saldada.');
    else t.push(`💸 Aún debes: *${dinero(ev.debe)}*`, `⏳ El próximo embargo será en *${cuando(CADA_EMBARGO)}* si no pagas.`);
    t.push('', `♻️ Recuperarlo: paga *${dinero(ev.costo)}* (lo abonado + 15%)`, `▸ *${prefix}banco recuperar*`);
    if (ev.perdidos.length) t.push('', `❌ Con este tercer embargo *ya no puedes recuperar* los anteriores: ${ev.perdidos.map((n) => `${n.emoji} ${n.nombre}`).join(', ')}. Tendrás que comprarlos de nuevo.`);
    if (!ev.cerrada) t.push('', ...opciones);
  } else return null;
  return [...CAB, ...t, '━━━━━━━━━━━━━━━━━━━━', '🐼 _Tu dinero, seguro con el panda_'].join('\n');
}

// Revisa a todos los deudores y avisa en el chat donde pidieron el préstamo
let temporizador = null;
async function revisarTodos(sock) {
  const { leerDB, guardarDB } = require('./db');
  const db = leerDB();
  const ahora = Date.now();
  const salidas = [];
  let cambio = false;
  for (const key of Object.keys(db.usuarios || {})) {
    const u = db.usuarios[key];
    if (!u || !u.prestamo || !u.prestamo.jid) continue;
    const antes = JSON.stringify(u);
    const chat = u.prestamo.jid;
    const ev = procesar(db, u, ahora);
    if (JSON.stringify(u) !== antes) cambio = true;
    const quien = `@${String(key).split('@')[0].split(':')[0]}`;
    for (const e of ev) { const texto = textoEvento(e, u, quien, '.', ahora); if (texto) salidas.push({ chat, key, texto }); }
  }
  if (cambio) guardarDB(db);
  for (const s of salidas) {
    try { await sock.sendMessage(s.chat, { text: s.texto, mentions: [s.key] }); } catch (err) { console.error('[prestamos] aviso:', err && err.message ? err.message : err); }
  }
}
function vigilar(sock, cada = 5 * 60 * 1000) {
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(() => { revisarTodos(sock).catch((e) => console.error('[prestamos]', e && e.message ? e.message : e)); }, cada);
  if (temporizador.unref) temporizador.unref();
  setTimeout(() => revisarTodos(sock).catch(() => {}), 20000).unref?.();
}

module.exports = { PLANES, PRORROGA, RECARGO_RECUPERAR, activos, historial, limite, calificacion, estado, ofertas, pedir, pagar, procesar, recuperar, embargosDe, textoEvento, vigilar, revisarTodos, redondear };

const N = require('./eco-negocios');
const { claveCanonica } = require('./db');

const DURACION = 15 * 60 * 1000;
const ULTIMO_MINUTO = 60 * 1000;
const ENFRIAMIENTO = 30 * 60 * 1000;
const INCREMENTO = 0.05;

const dueños = (db) => { if (!db.propiedadesUnicas) db.propiedadesUnicas = {}; return db.propiedadesUnicas; };
const estado = (db) => { if (!db.subasta) db.subasta = { activa: null, ultimaFin: 0 }; return db.subasta; };

const disponibles = (db) => N.NEGOCIOS.filter((n) => n.tipo === 'exclusiva' && !dueños(db)[n.id]);
const minimaPuja = (a, n) => (a.pujas ? Math.max(a.puja + 1, Math.ceil(a.puja * (1 + INCREMENTO))) : n.salida);

function resolver(db, ahora = Date.now()) {
  const est = estado(db);
  const a = est.activa;
  if (!a || a.fin > ahora) return null;
  const n = N.POR_ID[a.id];
  est.activa = null;
  est.ultimaFin = a.fin;
  if (!a.pujas || !a.ganador || !db.usuarios[a.ganador]) {
    return { sinPujas: true, n, jid: a.jid };
  }
  const u = db.usuarios[a.ganador];
  N.fijar(db, u, ahora);
  u.negocios = [...N.propios(u), n.id];
  u.negocioNiveles = { ...(u.negocioNiveles || {}), [n.id]: 0 };
  dueños(db)[n.id] = a.ganador;
  return { n, puja: a.puja, ganadorJid: a.ganadorJid, ganador: a.ganador, jid: a.jid, pujas: a.pujas };
}

function iniciar(db, jid, ahora = Date.now(), id = null) {
  const est = estado(db);
  if (est.activa) return { error: 'activa', activa: est.activa };
  const espera = (Number(est.ultimaFin) || 0) + ENFRIAMIENTO - ahora;
  if (espera > 0) return { error: 'espera', espera };
  const libres = disponibles(db);
  if (!libres.length) return { error: 'agotadas' };
  const n = (id && libres.find((x) => x.id === id)) || libres[Math.floor(Math.random() * libres.length)];
  est.activa = { id: n.id, jid, inicio: ahora, fin: ahora + DURACION, puja: 0, ganador: null, ganadorJid: null, pujas: 0 };
  return { activa: est.activa, n };
}

function pujar(db, u, llave, remitente, monto, ahora = Date.now()) {
  const est = estado(db);
  const a = est.activa;
  if (!a || a.fin <= ahora) return { error: 'ninguna' };
  const n = N.POR_ID[a.id];
  const minima = minimaPuja(a, n);
  if (!Number.isFinite(monto) || monto < minima) return { error: 'baja', minima };
  const propia = a.ganador === llave;
  const disponible = (Number(u.saldo) || 0) + (propia ? a.puja : 0);
  if (disponible < monto) return { error: 'saldo', disponible, monto };

  if (a.ganador && db.usuarios[a.ganador]) db.usuarios[a.ganador].saldo = (Number(db.usuarios[a.ganador].saldo) || 0) + a.puja;
  u.saldo = (Number(u.saldo) || 0) - monto;
  const superado = propia ? null : { llave: a.ganador, jid: a.ganadorJid, puja: a.puja };
  a.puja = monto;
  a.ganador = llave;
  a.ganadorJid = remitente;
  a.pujas += 1;
  let alargada = false;
  if (a.fin - ahora < ULTIMO_MINUTO) { a.fin = ahora + ULTIMO_MINUTO; alargada = true; }
  return { ok: true, n, activa: a, superado, alargada, saldo: u.saldo };
}

module.exports = { DURACION, ENFRIAMIENTO, INCREMENTO, disponibles, minimaPuja, resolver, iniciar, pujar, dueños, estado };

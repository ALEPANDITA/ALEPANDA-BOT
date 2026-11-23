const { leerDB, guardarDB, getUsuario } = require('./db');
const { exito, error: cajaError, advertencia } = require('./estilo');
const { reproducir, ocupar, liberar } = require('./cuadros');

const MINIMO = 10;

function leerMonto(palabra, saldo) {
  const p = String(palabra || '').toLowerCase();
  if (p === 'all' || p === 'todo') return saldo > 0 ? saldo : null;
  return /^\d+$/.test(p) && parseInt(p, 10) > 0 ? parseInt(p, 10) : null;
}

async function correr(sock, jid, msg, { titulo, apuesta, minimo = MINIMO, generar }) {
  const remitente = msg.key.participant || msg.key.remoteJid;
  const opts = { titulo, estilo: 'gamer' };
  if (apuesta < minimo) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${minimo}*.`, opts) }, { quoted: msg });
  if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', opts) }, { quoted: msg });
  try {
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, opts) }, { quoted: msg });

    const r = generar(usuario, remitente);
    usuario.saldo += r.cambio;
    guardarDB(db);

    const linea = `${r.detalle}\n\nSaldo actual: *$${usuario.saldo}*`;
    const final = r.cambio >= 0 ? exito(linea, opts) : cajaError(linea, opts);
    await reproducir(sock, jid, [...r.cuadros, { texto: final }], { quoted: msg, pausaMs: r.pausaMs || 900, mentions: [remitente] });
  } finally {
    liberar(remitente);
  }
}

const aviso = (sock, jid, msg, titulo, texto) => sock.sendMessage(jid, { text: advertencia(texto, { titulo, estilo: 'gamer' }) }, { quoted: msg });

module.exports = { correr, leerMonto, aviso, MINIMO };

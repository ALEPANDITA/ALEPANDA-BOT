const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar } = require('../../lib/cuadros');

const MINIMO = 10;
const PROB_CANTO = 0.03; // 3%: la moneda cae de canto y gana la casa (paga 97% en promedio)
const LADOS = { cara: { nombre: 'CARA', emoji: '👑' }, cruz: { nombre: 'CRUZ', emoji: '🦅' } };
const ALIAS = { c: 'cara', head: 'cara', heads: 'cara', x: 'cruz', sol: 'cruz', aguila: 'cruz', tails: 'cruz' };
const BLANCO = '\u3000'; // espacio ancho: mantiene el mensaje de la misma altura en todos los cuadros

function lanzar() {
  const r = Math.random();
  if (r < PROB_CANTO) return 'canto';
  return r < PROB_CANTO + (1 - PROB_CANTO) / 2 ? 'cara' : 'cruz';
}

// Escena: la moneda sube y baja (altura 0 = en la mesa, 4 = arriba)
function escena(altura, simbolo, pie) {
  const filas = [];
  for (let f = 4; f >= 0; f--) filas.push(f === altura ? `          ${simbolo}` : BLANCO);
  return [...filas, '     ▔▔▔▔▔▔▔▔▔▔▔▔▔', pie];
}

function resolver(eleccion) { return lanzar(); }

module.exports = {
  name: 'moneda',
  aliases: ['volado', 'coin', 'cf'],
  category: 'casino',
  description: `Volado animado: cara o cruz paga 1 a 1 (ojo: 3% cae de canto). Ej: .moneda 100 cara. Minimo $${MINIMO}`,
  _resolver: resolver,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());
    const eleccion = partes.map((p) => ALIAS[p] || p).find((p) => LADOS[p]) || null;
    const apuesta = partes.map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : NaN)).find((n) => n > 0);

    if (!eleccion || !apuesta) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}moneda <monto> <cara/cruz>\n• Si aciertas ganas lo mismo que apostaste (1 a 1)\nEj: ${prefix}moneda 100 cara`, { titulo: 'MONEDA', estilo: 'gamer' }) }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'MONEDA', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'MONEDA', estilo: 'gamer' }) }, { quoted: msg });

    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'MONEDA', estilo: 'gamer' }) }, { quoted: msg });

      const salio = lanzar();
      const gano = salio === eleccion;
      const cambio = gano ? apuesta : -apuesta;
      usuario.saldo += cambio;
      guardarDB(db);

      const yo = `@${remitente.split('@')[0]}`;
      const cabecera = `${yo} apuesta *$${apuesta}* a *${LADOS[eleccion].nombre}* ${LADOS[eleccion].emoji}`;
      const titulo = '🪙 *VOLADO* 🪙';
      const vuelo = [0, 1, 2, 3, 4, 4, 3, 2, 1, 0].map((h, i) => marco(titulo, [cabecera, '', ...escena(h, i % 2 ? '⚪' : '🪙', `Girando${'.'.repeat(1 + (i % 3))}`)]));
      const detalle = salio === 'canto'
        ? `😱 ¡La moneda cayó de *CANTO*!\nLa casa se queda tu apuesta.\nPerdiste *$${apuesta}*.`
        : `${LADOS[salio].emoji} Salió *${LADOS[salio].nombre}*\n${gano ? `¡Ganaste *$${cambio}*!` : `Perdiste *$${apuesta}*.`}`;
      const linea = `${cabecera}\n\n${detalle}\nSaldo actual: *$${usuario.saldo}*`;
      const final = gano ? exito(linea, { titulo: 'MONEDA', estilo: 'gamer' }) : cajaError(linea, { titulo: 'MONEDA', estilo: 'gamer' });

      await reproducir(sock, jid, [...vuelo, { texto: final }], { quoted: msg, pausaMs: 900, mentions: [remitente] });
    } finally {
      liberar(remitente);
    }
  }
};

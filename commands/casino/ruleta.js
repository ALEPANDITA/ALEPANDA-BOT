const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

const MINIMO = 10;
const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const COLORES = {
  rojo: 'rojo', red: 'rojo', roja: 'rojo',
  negro: 'negro', black: 'negro', negra: 'negro'
};

// Ruleta europea: 0 (verde) + 36 numeros. Rojo o negro paga 1 a 1; si sale el 0 pierden todos.
module.exports = {
  name: 'ruleta',
  aliases: ['rt', 'roulette', 'rtl'],
  category: 'casino',
  description: `Apuesta a la ruleta: rojo o negro (ej: .ruleta 100 rojo). Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());

    // acepta "100 rojo" y "rojo 100"
    const color = partes.map((p) => COLORES[p]).find(Boolean);
    const apuesta = partes.map((p) => parseInt(p, 10)).find((n) => Number.isInteger(n) && n > 0);

    if (!color || !apuesta) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}ruleta <monto> <rojo/negro>\nEj: ${prefix}ruleta 100 rojo`, { titulo: 'RULETA', estilo: 'gamer' })
      }, { quoted: msg });
    }

    if (apuesta < MINIMO) {
      return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'RULETA', estilo: 'gamer' }) }, { quoted: msg });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, {
        text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'RULETA', estilo: 'gamer' })
      }, { quoted: msg });
    }

    const numero = Math.floor(Math.random() * 37);
    const salio = numero === 0 ? 'verde' : (ROJOS.has(numero) ? 'rojo' : 'negro');
    const emoji = salio === 'verde' ? '🟢' : (salio === 'rojo' ? '🔴' : '⚫');
    const gano = salio === color;

    usuario.saldo += gano ? apuesta : -apuesta;
    guardarDB(db);

    const linea = `🎰 La ruleta cayo en ${emoji} *${numero}* (${salio}).\n` +
      (gano ? `¡Ganaste *$${apuesta}*!` : `Perdiste *$${apuesta}*.`) +
      `\nSaldo actual: *$${usuario.saldo}*`;

    await sock.sendMessage(jid, {
      text: gano
        ? exito(linea, { titulo: 'RULETA', estilo: 'gamer' })
        : cajaError(linea, { titulo: 'RULETA', estilo: 'gamer' })
    }, { quoted: msg });
  }
};

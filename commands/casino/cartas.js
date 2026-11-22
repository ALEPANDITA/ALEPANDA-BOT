const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, aleatorio } = require('../../lib/cuadros');

const MINIMO = 10;
const RANGOS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const PALOS = ['♠️', '♥️', '♦️', '♣️'];
const sacar = () => ({ r: aleatorio(13), p: aleatorio(4) });
const txt = (c) => `${RANGOS[c.r]}${PALOS[c.p]}`;

module.exports = {
  name: 'cartas',
  aliases: ['cartaalta', 'highcard', 'carta'],
  category: 'casino',
  description: `Carta alta: tú y la casa sacan una carta, gana la más alta (empate lo gana la casa). Paga 1 a 1. Ej: .cartas 100. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const apuesta = parseInt(texto.trim().split(/\s+/)[1], 10);
    if (!apuesta || apuesta <= 0) return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}cartas <monto>\nGana la carta más alta (A es la mayor). Si empatan, gana la casa. Paga 1 a 1.\nEj: ${prefix}cartas 100`, { titulo: 'CARTA ALTA', estilo: 'gamer' }) }, { quoted: msg });
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta mínima es *$${MINIMO}*.`, { titulo: 'CARTA ALTA', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'CARTA ALTA', estilo: 'gamer' }) }, { quoted: msg });
    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'CARTA ALTA', estilo: 'gamer' }) }, { quoted: msg });

      const a = sacar(); const b = sacar();
      const gano = a.r > b.r;
      usuario.saldo += gano ? apuesta : -apuesta;
      guardarDB(db);

      const t = '🃏 *CARTA ALTA* 🃏';
      const cab = `@${remitente.split('@')[0]} apuesta *$${apuesta}*`;
      const mesa = (tu, casa, pie) => marco(t, [cab, '', `🧑 Tú:   ${tu}`, `🏦 Casa: ${casa}`, '', pie]);
      const linea = `${cab}\n\n🧑 Tú: *${txt(a)}*   🏦 Casa: *${txt(b)}*\n` + (gano ? `¡Ganaste *$${apuesta}*!` : (a.r === b.r ? `Empate: gana la casa. Perdiste *$${apuesta}*.` : `Perdiste *$${apuesta}*.`)) + `\nSaldo actual: *$${usuario.saldo}*`;
      const final = gano ? exito(linea, { titulo: 'CARTA ALTA', estilo: 'gamer' }) : cajaError(linea, { titulo: 'CARTA ALTA', estilo: 'gamer' });
      await reproducir(sock, jid, [
        mesa('🂠', '🂠', 'Repartiendo...'),
        mesa(`*${txt(a)}*`, '🂠', 'Tu carta está arriba...'),
        mesa(`*${txt(a)}*`, '🂠 🂠', 'La casa voltea...'),
        { texto: final }], { quoted: msg, pausaMs: 1100, mentions: [remitente] });
    } finally { liberar(remitente); }
  }
};

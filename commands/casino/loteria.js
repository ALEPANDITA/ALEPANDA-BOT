const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, mezclar } = require('../../lib/cuadros');

const MINIMO = 10;
const PAGO = 3; // salen 3 de 10 bolas (30% de ganar): si sale la tuya cobras x3 en total
const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  name: 'loteria',
  aliases: ['lotto', 'bingo'],
  category: 'casino',
  description: `Lotería: eliges un número del 1 al 10 y salen 3 bolas. Si sale el tuyo cobras x${PAGO}. Ej: .loteria 100 7. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1);
    const apuesta = parseInt(partes[0], 10); const eleccion = parseInt(partes[1], 10);
    if (!apuesta || apuesta <= 0 || !(eleccion >= 1 && eleccion <= 10)) return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}loteria <monto> <1-10>\nSalen 3 bolas de 10. Si sale tu número, cobras x${PAGO}.\nEj: ${prefix}loteria 100 7`, { titulo: 'LOTERÍA', estilo: 'gamer' }) }, { quoted: msg });
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta mínima es *$${MINIMO}*.`, { titulo: 'LOTERÍA', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'LOTERÍA', estilo: 'gamer' }) }, { quoted: msg });
    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'LOTERÍA', estilo: 'gamer' }) }, { quoted: msg });

      const sacadas = mezclar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 3);
      const gano = sacadas.includes(eleccion);
      const cambio = gano ? apuesta * (PAGO - 1) : -apuesta;
      usuario.saldo += cambio;
      guardarDB(db);

      const t = '🎱 *LOTERÍA* 🎱';
      const cab = `@${remitente.split('@')[0]} apuesta *$${apuesta}* al ${NUM[eleccion - 1]}`;
      const bolas = (n) => (n ? sacadas.slice(0, n).map((x) => NUM[x - 1]).join('  ') : '—');
      const mesa = (n, pie) => marco(t, [cab, '', `🎱 Bolas: ${bolas(n)}`, '', pie]);
      const linea = `${cab}\n\n🎱 Salieron: ${bolas(3)}\n` + (gano ? `¡Salió tu número! Ganaste *$${cambio}*.` : `No salió tu número. Perdiste *$${apuesta}*.`) + `\nSaldo actual: *$${usuario.saldo}*`;
      const final = gano ? exito(linea, { titulo: 'LOTERÍA', estilo: 'gamer' }) : cajaError(linea, { titulo: 'LOTERÍA', estilo: 'gamer' });
      await reproducir(sock, jid, [
        mesa(0, 'Mezclando las bolas 🌀🌀'), mesa(0, 'Mezclando las bolas 🌀🌀🌀'),
        mesa(1, 'Sale la 1ª bola...'), mesa(2, 'Sale la 2ª bola...'), mesa(3, 'Sale la 3ª bola...'),
        { texto: final }], { quoted: msg, pausaMs: 1100, mentions: [remitente] });
    } finally { liberar(remitente); }
  }
};

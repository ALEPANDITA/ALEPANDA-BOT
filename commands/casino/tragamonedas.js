const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const simbolos = ['🍒', '🍋', '🍇', '💎', '⭐', '🔔'];

module.exports = {
  name: 'tragamonedas',
  category: 'casino',
  description: 'Jugar tragamonedas (ej: .tragamonedas 100)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const apuesta = parseInt(partes[1]);

    if (!apuesta || apuesta <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}tragamonedas <monto>` });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: `No tienes suficiente saldo. Tu saldo: $${usuario.saldo}` });
    }

    const r1 = simbolos[Math.floor(Math.random() * simbolos.length)];
    const r2 = simbolos[Math.floor(Math.random() * simbolos.length)];
    const r3 = simbolos[Math.floor(Math.random() * simbolos.length)];

    let resultado;
    let ganancia = 0;

    if (r1 === r2 && r2 === r3) {
      ganancia = apuesta * 5;
      resultado = `🎉 ¡TRIPLE! Ganaste *$${ganancia}*`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      ganancia = apuesta * 2;
      resultado = `✨ ¡Par! Ganaste *$${ganancia}*`;
    } else {
      ganancia = -apuesta;
      resultado = `💸 Perdiste *$${apuesta}*`;
    }

    usuario.saldo += ganancia;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: `🎰 [ ${r1} | ${r2} | ${r3} ]\n\n${resultado}\nSaldo actual: *$${usuario.saldo}*`
    });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia, caja } = require('../../lib/estilo');

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
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}tragamonedas <monto>`, { titulo: 'TRAGAMONEDAS' })
      });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, {
        text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`)
      });
    }

    const r1 = simbolos[Math.floor(Math.random() * simbolos.length)];
    const r2 = simbolos[Math.floor(Math.random() * simbolos.length)];
    const r3 = simbolos[Math.floor(Math.random() * simbolos.length)];

    let resultado;
    let ganancia = 0;
    let gano = true;

    if (r1 === r2 && r2 === r3) {
      ganancia = apuesta * 5;
      resultado = `🎉 ¡TRIPLE! Ganaste *$${ganancia}*`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      ganancia = apuesta * 2;
      resultado = `✨ ¡Par! Ganaste *$${ganancia}*`;
    } else {
      ganancia = -apuesta;
      resultado = `💸 Perdiste *$${apuesta}*`;
      gano = false;
    }

    usuario.saldo += ganancia;
    guardarDB(db);

    const lineas = [
      `[ ${r1} | ${r2} | ${r3} ]`,
      '',
      resultado,
      `Saldo actual: *$${usuario.saldo}*`
    ];

    const textoFinal = gano
      ? caja(lineas, { titulo: '🎰 TRAGAMONEDAS', estilo: 'gamer' })
      : caja(lineas, { titulo: '🎰 TRAGAMONEDAS', estilo: 'gamer' });

    await sock.sendMessage(jid, { text: textoFinal });
  }
};

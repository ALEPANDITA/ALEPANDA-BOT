const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');

function generarOperacion() {
  const operaciones = ['+', '-', '*'];
  const op = operaciones[Math.floor(Math.random() * operaciones.length)];
  let a, b;

  if (op === '*') {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
  } else {
    a = Math.floor(Math.random() * 100) + 1;
    b = Math.floor(Math.random() * 100) + 1;
  }

  let resultado;
  if (op === '+') resultado = a + b;
  else if (op === '-') resultado = a - b;
  else resultado = a * b;

  return { texto: `${a} ${op} ${b}`, resultado };
}

module.exports = {
  name: 'matematicas',
  category: 'economia',
  description: 'Resuelve una operacion rapido y gana dinero (15 segundos)',
  execute: async (sock, jid, msg) => {
    if (obtenerJuego(jid)) {
      return sock.sendMessage(jid, { text: 'Ya hay un juego activo en este chat.' });
    }

    const remitente = msg.key.participant || msg.key.remoteJid;
    const { texto: operacion, resultado } = generarOperacion();

    const timeout = setTimeout(async () => {
      if (obtenerJuego(jid)) {
        terminarJuego(jid);
        await sock.sendMessage(jid, { text: `⏰ Se acabo el tiempo! La respuesta era *${resultado}*.` });
      }
    }, 15000);

    iniciarJuego(jid, {
      tipo: 'matematicas',
      manejarRespuesta: async (sock, jid, msg, texto) => {
        const intento = parseInt(texto.trim(), 10);
        if (isNaN(intento)) return;

        if (intento === resultado) {
          clearTimeout(timeout);
          terminarJuego(jid);

          const quienResponde = msg.key.participant || msg.key.remoteJid;
          const db = leerDB();
          const usuario = getUsuario(db, quienResponde);
          const premio = Math.floor(Math.random() * 100) + 50;
          usuario.saldo += premio;
          guardarDB(db);

          await sock.sendMessage(jid, {
            text: `🎉 Correcto! Ganaste *$${premio}*.\nSaldo actual: *$${usuario.saldo}*`
          });
        } else {
          await sock.sendMessage(jid, { text: '❌ Incorrecto, sigue intentando.' });
        }
      }
    });

    await sock.sendMessage(jid, {
      text: `🧮 *MATEMATICAS RAPIDAS*\n\n¿Cuanto es *${operacion}*?\nTienes 15 segundos para responder.`
    });
  }
};

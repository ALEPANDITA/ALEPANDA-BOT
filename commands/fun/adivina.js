const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');

module.exports = {
  name: 'adivina',
  category: 'fun',
  description: 'Adivina el numero secreto (1-100)',
  execute: async (sock, jid, msg, { prefix }) => {
    if (obtenerJuego(jid)) {
      return sock.sendMessage(jid, { text: 'Ya hay un juego activo en este chat. Escribe "salir" para cancelarlo.' });
    }

    const numeroSecreto = Math.floor(Math.random() * 100) + 1;
    let intentos = 0;

    iniciarJuego(jid, {
      tipo: 'adivina',
      manejarRespuesta: async (sock, jid, msg, texto) => {
        if (texto.trim().toLowerCase() === 'salir') {
          terminarJuego(jid);
          return sock.sendMessage(jid, { text: 'Juego cancelado. El numero era ' + numeroSecreto + '.' });
        }

        const intento = parseInt(texto.trim(), 10);
        if (isNaN(intento)) return;

        intentos++;

        if (intento === numeroSecreto) {
          terminarJuego(jid);
          return sock.sendMessage(jid, {
            text: `🎉 Correcto! El numero era *${numeroSecreto}*. Lo lograste en ${intentos} intento(s).`
          });
        }

        const pista = intento < numeroSecreto ? '📈 Mas alto' : '📉 Mas bajo';
        await sock.sendMessage(jid, { text: pista });
      }
    });

    await sock.sendMessage(jid, {
      text: `🔢 Pense un numero entre 1 y 100. Escribe tu intento (o "salir" para cancelar).`
    });
  }
};

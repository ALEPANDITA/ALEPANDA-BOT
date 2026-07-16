const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');

const palabras = [
  'javascript', 'whatsapp', 'programacion', 'computadora', 'servidor',
  'internet', 'teclado', 'pantalla', 'aplicacion', 'desarrollador'
];

function dibujar(palabra, adivinadas) {
  return palabra.split('').map(l => (adivinadas.includes(l) ? l : '_')).join(' ');
}

module.exports = {
  name: 'ahorcado',
  category: 'fun',
  description: 'Juega ahorcado, adivinando letra por letra',
  execute: async (sock, jid, msg) => {
    if (obtenerJuego(jid)) {
      return sock.sendMessage(jid, { text: 'Ya hay un juego activo en este chat. Escribe "salir" para cancelarlo.' });
    }

    const palabra = palabras[Math.floor(Math.random() * palabras.length)];
    const adivinadas = [];
    let vidas = 6;

    iniciarJuego(jid, {
      tipo: 'ahorcado',
      manejarRespuesta: async (sock, jid, msg, texto) => {
        const entrada = texto.trim().toLowerCase();

        if (entrada === 'salir') {
          terminarJuego(jid);
          return sock.sendMessage(jid, { text: `Juego cancelado. La palabra era *${palabra}*.` });
        }

        if (entrada.length !== 1 || !/[a-zñ]/.test(entrada)) return;

        if (adivinadas.includes(entrada)) {
          return sock.sendMessage(jid, { text: `Ya intentaste con "${entrada}".` });
        }

        adivinadas.push(entrada);

        if (!palabra.includes(entrada)) {
          vidas--;
        }

        if (!palabra.includes(entrada) && vidas <= 0) {
          terminarJuego(jid);
          return sock.sendMessage(jid, {
            text: `💀 Perdiste! La palabra era *${palabra}*.`
          });
        }

        if (palabra.split('').every(l => adivinadas.includes(l))) {
          terminarJuego(jid);
          return sock.sendMessage(jid, {
            text: `🎉 Ganaste! La palabra era *${palabra}*.`
          });
        }

        await sock.sendMessage(jid, {
          text: `${dibujar(palabra, adivinadas)}\n\n❤️ Vidas: ${vidas}\nLetras usadas: ${adivinadas.join(', ') || 'ninguna'}`
        });
      }
    });

    await sock.sendMessage(jid, {
      text: `🪢 *AHORCADO*\n${dibujar(palabra, adivinadas)}\n\n❤️ Vidas: ${vidas}\nEscribe una letra (o "salir" para cancelar).`
    });
  }
};

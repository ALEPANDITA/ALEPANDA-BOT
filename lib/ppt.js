const { obtenerJuego, terminarJuego } = require('./juegos');
const { caja, porCategoria } = require('./estilo');

const OPCIONES = {
  piedra: { emoji: '🪨', nombre: 'Piedra' },
  papel: { emoji: '📄', nombre: 'Papel' },
  tijera: { emoji: '✂️', nombre: 'Tijera' }
};

function ganador(a, b) {
  if (a === b) return 'empate';
  if (
    (a === 'piedra' && b === 'tijera') ||
    (a === 'papel' && b === 'piedra') ||
    (a === 'tijera' && b === 'papel')
  ) return 'p1';
  return 'p2';
}

// Registra la jugada de un jugador en el duelo activo de ese chat, sin
// importar si vino de un boton tocado o de texto escrito a mano. Revela
// el resultado en cuanto los 2 jugadores ya eligieron.
async function registrarJugadaPPT(sock, jid, remitente, opcion) {
  const estilo = porCategoria('fun');

  if (!OPCIONES[opcion]) return;

  const juego = obtenerJuego(jid);
  if (!juego || juego.tipo !== 'ppt') {
    return sock.sendMessage(jid, {
      text: caja(['Este duelo ya no esta activo.'], { titulo: 'PPT', estilo })
    });
  }

  const { jugadores, elecciones } = juego.datos;

  if (!jugadores.includes(remitente)) {
    return sock.sendMessage(jid, {
      text: caja(['Este duelo no es tuyo 👀'], { titulo: 'PPT', estilo })
    });
  }

  if (elecciones[remitente]) {
    return sock.sendMessage(jid, {
      text: caja(['Ya elegiste tu jugada. Espera a tu rival.'], { titulo: 'PPT', estilo })
    });
  }

  elecciones[remitente] = opcion;

  const [jugador1, jugador2] = jugadores;
  const faltante = jugadores.find(j => !elecciones[j]);

  if (faltante) {
    return sock.sendMessage(jid, {
      text: caja(
        [`✅ @${remitente.split('@')[0]} ya eligio su jugada.`, `Esperando a @${faltante.split('@')[0]} 👀`],
        { titulo: '⚔️ DUELO PPT', estilo }
      ),
      mentions: [remitente, faltante]
    });
  }

  // Ya eligieron los 2: revelar resultado y cerrar el juego.
  terminarJuego(jid);

  const e1 = elecciones[jugador1];
  const e2 = elecciones[jugador2];
  const resultado = ganador(e1, e2);

  const lineaResultado = resultado === 'empate'
    ? '🤝 EMPATE'
    : `🎉 GANO @${(resultado === 'p1' ? jugador1 : jugador2).split('@')[0]}`;

  await sock.sendMessage(jid, {
    text: caja(
      [
        `@${jugador1.split('@')[0]}  ${OPCIONES[e1].emoji} ${OPCIONES[e1].nombre}`,
        `@${jugador2.split('@')[0]}  ${OPCIONES[e2].emoji} ${OPCIONES[e2].nombre}`,
        '',
        lineaResultado
      ],
      { titulo: '🏆 RESULTADO PPT', estilo }
    ),
    mentions: [jugador1, jugador2]
  });
}

module.exports = { OPCIONES, registrarJugadaPPT };

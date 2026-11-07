const { obtenerJuego, terminarJuego } = require('./juegos');
const { caja, porCategoria } = require('./estilo');
const { mismaPersona, mismoNumero, idsDeRemitente } = require('./identidad');

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
// Devuelve el id del jugador (tal como quedo guardado en el duelo) al que pertenece el mensaje, o null si es otra persona.
// Aguanta que el mismo usuario llegue como numero o como @lid.
async function jugadorDelMensaje(sock, jid, msg, jugadores) {
  const ids = idsDeRemitente(msg);
  const rapido = jugadores.find((j) => mismoNumero(j, ids));
  if (rapido) return rapido;
  for (const j of jugadores) if (await mismaPersona(sock, jid, j, ids)) return j;
  return null;
}

// `msg` es el mensaje de quien juega (se usa para saber quien es)
async function registrarJugadaPPT(sock, jid, msg, opcion) {
  const estilo = porCategoria('fun');

  if (!OPCIONES[opcion]) return;

  const juego = obtenerJuego(jid);
  if (!juego || juego.tipo !== 'ppt') {
    return sock.sendMessage(jid, {
      text: caja(['Este duelo ya no esta activo.'], { titulo: 'PPT', estilo })
    });
  }

  const { jugadores, elecciones } = juego.datos;

  const remitente = await jugadorDelMensaje(sock, jid, msg, jugadores);
  if (!remitente) {
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

module.exports = { OPCIONES, registrarJugadaPPT, jugadorDelMensaje };

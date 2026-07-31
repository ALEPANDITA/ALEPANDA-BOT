// Almacena las partidas activas en memoria, una por chat (jid).
// Cada juego registrado debe tener: { tipo, datos, manejarRespuesta(sock, jid, msg, texto) }
const juegosActivos = new Map();

function iniciarJuego(jid, juego) {
  juegosActivos.set(jid, juego);
}

function obtenerJuego(jid) {
  return juegosActivos.get(jid);
}

function terminarJuego(jid) {
  juegosActivos.delete(jid);
}

module.exports = { juegosActivos, iniciarJuego, obtenerJuego, terminarJuego };

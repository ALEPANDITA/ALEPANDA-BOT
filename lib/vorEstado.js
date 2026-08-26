// lib/vorEstado.js
// Guarda, por grupo, el estado del juego .vor (Verdad o Reto):
//   - elegidosAleatorio: quienes ya salieron elegidos al azar (para no
//     repetir persona hasta el proximo reinicio, SOLO cuando el bot elige
//     por su cuenta; si alguien usa @mencion, se lo salta).
//   - usadosPorPersona: que preguntas/retos (por id) ya le tocaron a cada
//     quien, para no repetirle el mismo dos veces.
//   - creadoEn: cuando empezo este ciclo, para saber cuando reiniciar.
//
// Todo vive en memoria (no en disco). Si el bot se reinicia, el ciclo
// arranca de cero, lo cual esta bien para este tipo de juego.

const HORAS_REINICIO = 10;
const MS_REINICIO = HORAS_REINICIO * 60 * 60 * 1000;

const estadosPorGrupo = new Map();

function obtenerEstado(jid) {
  let estado = estadosPorGrupo.get(jid);
  const ahora = Date.now();

  if (!estado || (ahora - estado.creadoEn) >= MS_REINICIO) {
    estado = {
      creadoEn: ahora,
      elegidosAleatorio: new Set(),
      usadosPorPersona: new Map() // participanteId -> Set(ids de items ya usados)
    };
    estadosPorGrupo.set(jid, estado);
  }

  return estado;
}

function minutosParaReinicio(jid) {
  const estado = estadosPorGrupo.get(jid);
  if (!estado) return 0;
  const restante = MS_REINICIO - (Date.now() - estado.creadoEn);
  return Math.max(0, Math.round(restante / 60000));
}

function reiniciarManual(jid) {
  estadosPorGrupo.delete(jid);
}

// Poda de respaldo para el monitor de memoria: quita grupos inactivos por
// mucho tiempo (ya vencidos hace rato y nadie volvio a jugar ahi).
function podarGruposInactivos() {
  const ahora = Date.now();
  let podados = 0;
  for (const [jid, estado] of estadosPorGrupo.entries()) {
    if ((ahora - estado.creadoEn) >= MS_REINICIO * 3) {
      estadosPorGrupo.delete(jid);
      podados++;
    }
  }
  return podados;
}

module.exports = { obtenerEstado, minutosParaReinicio, reiniciarManual, podarGruposInactivos, HORAS_REINICIO };

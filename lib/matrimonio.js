// Maneja las propuestas de matrimonio pendientes de respuesta.
// Se guardan en memoria (no en database.json) porque son temporales:
// si el bot se reinicia, las propuestas sin responder simplemente se pierden,
// lo cual esta bien porque de todas formas expiran solas.

const TIEMPO_EXPIRA = 2 * 60 * 1000; // 2 minutos para responder

// Map: stanzaId (id del mensaje de propuesta) -> { de, para, jid, timestamp }
const propuestasPorMensaje = new Map();

function limpiarExpiradas() {
  const ahora = Date.now();
  for (const [stanzaId, propuesta] of propuestasPorMensaje.entries()) {
    if (ahora - propuesta.timestamp > TIEMPO_EXPIRA) {
      propuestasPorMensaje.delete(stanzaId);
    }
  }
}

// Evita que una misma persona tenga varias propuestas activas al mismo tiempo
// (ni como quien propone, ni como quien recibe).
function tienePropuestaActiva(numeroId) {
  limpiarExpiradas();
  for (const propuesta of propuestasPorMensaje.values()) {
    if (propuesta.de === numeroId || propuesta.para === numeroId) return true;
  }
  return false;
}

module.exports = { propuestasPorMensaje, limpiarExpiradas, tienePropuestaActiva, TIEMPO_EXPIRA };

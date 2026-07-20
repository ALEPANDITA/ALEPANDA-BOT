const propuestasPorMensaje = new Map();
const TIEMPO_EXPIRA = 5 * 60 * 1000;

function limpiarExpiradas() {
  const ahora = Date.now();
  for (const [id, propuesta] of propuestasPorMensaje.entries()) {
    if (propuesta.expira < ahora) propuestasPorMensaje.delete(id);
  }
}

module.exports = { propuestasPorMensaje, TIEMPO_EXPIRA, limpiarExpiradas };

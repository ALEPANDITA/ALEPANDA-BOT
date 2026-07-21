const busquedas = new Map();
const DURACION_MS = 15 * 60 * 1000;

function guardarBusquedaStickerly(jid, packs) {
  busquedas.set(jid, { packs, expira: Date.now() + DURACION_MS });
}

function obtenerBusquedaStickerly(jid, numero) {
  const entrada = busquedas.get(jid);
  if (!entrada || Date.now() > entrada.expira) {
    busquedas.delete(jid);
    return null;
  }
  const indice = Number(numero) - 1;
  return entrada.packs[indice] || null;
}

module.exports = { guardarBusquedaStickerly, obtenerBusquedaStickerly };

// Guarda temporalmente los resultados de la ultima busqueda de YouTube por chat,
// para poder descargar con ".ytmp3 <numero>" o ".ytmp4 <numero>" sin botones.
// Se limpia solo despues de 15 minutos para no acumular memoria indefinidamente.

const busquedas = new Map();
const DURACION_MS = 15 * 60 * 1000;

function guardarBusqueda(jid, videos) {
  busquedas.set(jid, { videos, expira: Date.now() + DURACION_MS });
}

function obtenerBusqueda(jid, numero) {
  const entrada = busquedas.get(jid);
  if (!entrada || Date.now() > entrada.expira) {
    busquedas.delete(jid);
    return null;
  }
  const indice = Number(numero) - 1;
  return entrada.videos[indice] || null;
}

module.exports = { guardarBusqueda, obtenerBusqueda };

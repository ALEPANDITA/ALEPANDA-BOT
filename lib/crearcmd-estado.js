// lib/crearcmd-estado.js
// Guarda en memoria (por chat/jid) el ultimo intento de generar un comando
// con IA, para poder "arreglarlo" en el siguiente mensaje sin que el usuario
// tenga que repetir toda la descripcion original.
//
// Ademas guarda un HISTORIAL de las versiones que SI llegaron a instalarse
// con exito, para poder volver a una version anterior (o a la primera de
// todas) si una correccion cambio mas de lo que se queria.
//
// No se persiste a disco a proposito: si el bot se reinicia, se empieza de
// cero (mas simple y evita arrastrar intentos viejos/rotos). Osea que el
// historial de versiones tambien se pierde si el bot se reinicia.

const MAX_VERSIONES_GUARDADAS = 15;

const estados = new Map(); // jid -> { actual: {...}, historial: [...] }

function obtenerEstado(jid) {
  return estados.get(jid)?.actual || null;
}

function obtenerHistorial(jid) {
  return estados.get(jid)?.historial || [];
}

function guardarEstado(jid, nuevoEstado) {
  const entrada = estados.get(jid);
  const anterior = entrada?.actual || null;
  let historial = entrada?.historial || [];

  // Si la version que se va a reemplazar SI estaba instalada y funcionando,
  // la archivamos antes de perderla (para poder volver a ella despues).
  const yaEstaAlFinal = historial.length && historial[historial.length - 1].codigo === anterior?.codigo;
  if (anterior?.estado === 'exito' && anterior.codigo && anterior.rutaArchivoFinal && !yaEstaAlFinal) {
    historial = [...historial, {
      codigo: anterior.codigo,
      nombre: anterior.nombre,
      categoria: anterior.categoria,
      rutaArchivoFinal: anterior.rutaArchivoFinal,
      descripcionOriginal: anterior.descripcionOriginal,
      guardado: anterior.actualizado || Date.now()
    }].slice(-MAX_VERSIONES_GUARDADAS);
  }

  estados.set(jid, { actual: { ...nuevoEstado, actualizado: Date.now() }, historial });
}

function borrarEstado(jid) {
  estados.delete(jid);
}

/**
 * Mira (sin quitar todavia) que version tomaria un "deshacer".
 * @param {boolean} primeraVersion - si true, la mas vieja guardada; si false, la mas reciente (un paso atras).
 */
function verVersionHistorial(jid, { primeraVersion = false } = {}) {
  const historial = obtenerHistorial(jid);
  if (!historial.length) return null;
  return primeraVersion ? historial[0] : historial[historial.length - 1];
}

/**
 * Quita del historial la version que se va a restaurar (para no ofrecerla dos veces).
 * Llamar SOLO despues de confirmar que la restauracion funciono.
 */
function quitarDelHistorial(jid, { primeraVersion = false } = {}) {
  const entrada = estados.get(jid);
  if (!entrada || !entrada.historial.length) return;
  const indice = primeraVersion ? 0 : entrada.historial.length - 1;
  entrada.historial = entrada.historial.filter((_, i) => i !== indice);
}

module.exports = {
  obtenerEstado,
  guardarEstado,
  borrarEstado,
  obtenerHistorial,
  verVersionHistorial,
  quitarDelHistorial
};

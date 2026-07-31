// lib/crearcmd-estado.js
// Guarda en memoria (por chat/jid) el ultimo intento de generar un comando
// con IA, para poder "arreglarlo" en el siguiente mensaje sin que el usuario
// tenga que repetir toda la descripcion original.
//
// No se persiste a disco a proposito: si el bot se reinicia, se empieza de
// cero (mas simple y evita arrastrar intentos viejos/rotos).

const estados = new Map(); // jid -> estado

function obtenerEstado(jid) {
  return estados.get(jid) || null;
}

function guardarEstado(jid, estado) {
  estados.set(jid, { ...estado, actualizado: Date.now() });
}

function borrarEstado(jid) {
  estados.delete(jid);
}

module.exports = { obtenerEstado, guardarEstado, borrarEstado };

// Todas las IAs de conversacion juntas. index.js llama a manejarMensaje(); .boton usa porId()/activar().
const pandita = require('./pandita');
const mei = require('./mei');

const TODAS = [pandita, mei];

const porId = (id) => TODAS.find((p) => p.id === String(id || '').toLowerCase()) || null;

// Cada una decide sola si el mensaje es para ella (activada + mencion/respuesta en grupos).
// Devuelve true si alguna lo atendio.
async function manejarMensaje(args) {
  let atendido = false;
  for (const p of TODAS) {
    try {
      if (await p.manejarMensaje(args)) atendido = true;
    } catch (e) {
      console.error(`[${p.id}] hook:`, e);
    }
  }
  return atendido;
}

// Activa/desactiva una IA en un chat. En PRIVADO solo puede haber una activa (si no, las dos contestarian cada
// mensaje): al activar una se apagan las demas. En grupos pueden convivir, cada una responde a su @mencion.
// Devuelve la lista de IAs que se apagaron por el cambio.
function activar(persona, jid, valor) {
  const apagadas = [];
  if (valor && !jid.endsWith('@g.us')) {
    for (const otra of TODAS) {
      if (otra !== persona && otra.estaActiva(jid)) { otra.setActiva(jid, false); apagadas.push(otra); }
    }
  }
  persona.setActiva(jid, valor);
  return apagadas;
}

module.exports = { TODAS, porId, manejarMensaje, activar };

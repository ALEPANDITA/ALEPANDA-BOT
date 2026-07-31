const { registrarJugadaPPT } = require('../../lib/ppt');

// Paso interno de .ppt: cada boton (piedra/papel/tijera) llama a este
// comando. No se usa directamente escribiendolo, es el id de los botones.
module.exports = {
  name: 'pptjugar',
  category: 'fun',
  description: 'Uso interno: registra la jugada de un duelo .ppt',
  execute: async (sock, jid, msg, { texto }) => {
    const opcion = (texto || '').trim().split(/\s+/)[1];
    const remitente = msg.key.participant || msg.key.remoteJid;
    await registrarJugadaPPT(sock, jid, remitente, opcion);
  }
};

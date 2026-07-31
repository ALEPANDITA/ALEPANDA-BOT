const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { preguntaAleatoria, esRespuestaCorrecta } = require('../../lib/trivia');
const { advertencia } = require('../../lib/estilo');

const PUNTOS_POR_VICTORIA = 4;

function otorgarPuntos(ganadorJid) {
  const db = leerDB();
  const usuario = getUsuario(db, ganadorJid);
  usuario.triviaPuntos = (usuario.triviaPuntos || 0) + PUNTOS_POR_VICTORIA;
  usuario.triviaVictorias = (usuario.triviaVictorias || 0) + 1;
  guardarDB(db);
}

module.exports = {
  name: 'trivia',
  category: 'fun',
  description: 'Inicia una trivia en el chat, el primero en responder bien gana puntos. Uso: .trivia | responde escribiendo tu respuesta | .trivia rendirse',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/).slice(1);
    const input = (partes[0] || '').toLowerCase();
    const juegoActivo = obtenerJuego(jid);

    if (input === 'rendirse' || input === 'salir') {
      if (!juegoActivo || juegoActivo.tipo !== 'trivia') {
        return sock.sendMessage(jid, { text: advertencia('No hay ninguna trivia activa en este chat.', { titulo: 'TRIVIA' }) });
      }
      terminarJuego(jid);
      return sock.sendMessage(jid, { text: `🏳️ Trivia cancelada. La respuesta era *${juegoActivo.datos.pregunta.respuestas[0]}*.` });
    }

    if (juegoActivo) {
      if (juegoActivo.tipo === 'trivia') {
        return sock.sendMessage(jid, {
          text: advertencia('Ya hay una trivia activa en este chat, responde escribiendo tu respuesta directamente.', { titulo: 'TRIVIA' })
        });
      }
      return sock.sendMessage(jid, {
        text: advertencia('Ya hay otro juego activo en este chat. Termina o cancela ese primero.', { titulo: 'TRIVIA' })
      });
    }

    const pregunta = preguntaAleatoria();

    iniciarJuego(jid, {
      tipo: 'trivia',
      datos: { pregunta },
      manejarRespuesta: async (sock, jid, msg, respuestaTexto) => {
        if (!esRespuestaCorrecta(pregunta, respuestaTexto)) return;

        const remitente = msg.key.participant || msg.key.remoteJid;
        terminarJuego(jid);
        otorgarPuntos(remitente);

        await sock.sendMessage(jid, {
          text: `🎉 @${remitente.split('@')[0]} acerto! La respuesta era *${pregunta.respuestas[0]}* (+${PUNTOS_POR_VICTORIA} puntos)`,
          mentions: [remitente]
        });
      }
    });

    await sock.sendMessage(jid, {
      text: `🧠 *TRIVIA*\n\n${pregunta.pregunta}\n\nEscribe tu respuesta en el chat. Usa ${prefix}trivia rendirse para cancelar.`
    });
  }
};

const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');
const { caja, porCategoria } = require('../../lib/estilo');
const { OPCIONES, registrarJugadaPPT, jugadorDelMensaje } = require('../../lib/ppt');
const { mismoNumero, idsDeRemitente } = require('../../lib/identidad');

const DURACION_MS = 5 * 60 * 1000;

module.exports = {
  name: 'ppt',
  aliases: ['piedrapapeltijera', 'rps'],
  category: 'fun',
  description: 'Duelo de piedra, papel o tijera entre 2 usuarios con botones. Uso: .ppt @usuario',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const jugador1 = msg.key.participant || msg.key.remoteJid;
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const estilo = porCategoria('fun');

    if (!mencionado) {
      return sock.sendMessage(jid, {
        text: caja(
          [`Uso: ${prefix}ppt @usuario`, 'Menciona a la persona que quieres retar.'],
          { titulo: 'PPT', estilo }
        )
      });
    }

    // Comparacion rapida (sin consultar al grupo): retar a alguien no debe demorar el duelo
    if (mismoNumero(mencionado, idsDeRemitente(msg))) {
      return sock.sendMessage(jid, {
        text: caja(['No puedes retarte a ti mismo 😅'], { titulo: 'PPT', estilo })
      });
    }

    const juegoExistente = obtenerJuego(jid);
    if (juegoExistente) {
      const vencido = juegoExistente.datos?.creado && (Date.now() - juegoExistente.datos.creado > DURACION_MS);
      if (vencido) {
        terminarJuego(jid);
      } else {
        return sock.sendMessage(jid, {
          text: caja(['Ya hay un juego activo en este chat.'], { titulo: 'ATENCION', estilo })
        });
      }
    }

    const jugador2 = mencionado;

    iniciarJuego(jid, {
      tipo: 'ppt',
      datos: {
        jugadores: [jugador1, jugador2],
        elecciones: {},
        creado: Date.now()
      },
      // El duelo se juega con botones, pero tambien acepta la jugada
      // escrita a mano (piedra/papel/tijera) por si los botones no se ven
      // en algun dispositivo -- y "cancelar" para salir sin esperar.
      manejarRespuesta: async (sock, jid, msg, textoResp) => {
        const palabra = textoResp.trim().toLowerCase();

        if (palabra === 'cancelar' && await jugadorDelMensaje(sock, jid, msg, [jugador1, jugador2])) {
          terminarJuego(jid);
          await sock.sendMessage(jid, {
            text: caja(['El duelo fue cancelado.'], { titulo: 'PPT CANCELADO', estilo })
          });
          return;
        }

        if (OPCIONES[palabra]) {
          await registrarJugadaPPT(sock, jid, msg, palabra);
        }
      }
    });

    // OJO: los "buttons" normales de sock.sendMessage no se ven en WhatsApp (el mensaje se manda sin error pero no aparece;
    // ver el comentario en ytsearch.js). Por eso el duelo SIEMPRE sale como texto normal (se juega escribiendo piedra / papel /
    // tijera) y los botones van aparte, solo si esta instalado baileys_helper (el mismo que usa .ytsearch).
    try {
      await sock.sendMessage(jid, {
        text: caja(
          [
            `🥊 @${jugador1.split('@')[0]}  🆚  @${jugador2.split('@')[0]}`,
            '',
            'Escribe tu jugada: piedra / papel / tijera',
            'El resultado se revela cuando los 2 hayan elegido.',
            `(Para salir sin esperar, escribe: cancelar)`
          ],
          { titulo: '⚔️ DUELO PPT', estilo }
        ),
        mentions: [jugador1, jugador2]
      });
    } catch (err) {
      terminarJuego(jid); // para que el chat no se quede con un duelo que nadie vio
      throw err;
    }

    try {
      const { sendButtons } = require('baileys_helper');
      const boton = (texto, id) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: texto, id }) });
      await sendButtons(sock, jid, {
        text: 'Toca tu jugada 👇',
        footer: 'ALEPANDA BOT',
        buttons: [
          boton('🪨 Piedra', `${prefix}pptjugar piedra`),
          boton('📄 Papel', `${prefix}pptjugar papel`),
          boton('✂️ Tijera', `${prefix}pptjugar tijera`)
        ]
      });
    } catch (err) {
      // Sin botones no pasa nada: el duelo ya se puede jugar escribiendo
      if (!/Cannot find module/.test(String(err && err.message))) console.warn('[ppt] No pude mandar los botones:', err && err.message ? err.message : err);
    }
  }
};

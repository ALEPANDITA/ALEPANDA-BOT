const { iniciarJuego, obtenerJuego, terminarJuego } = require('../../lib/juegos');
const { caja, porCategoria } = require('../../lib/estilo');
const { OPCIONES, registrarJugadaPPT, jugadorDelMensaje } = require('../../lib/ppt');
const { mismaPersona, idsDeRemitente } = require('../../lib/identidad');

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

    if (await mismaPersona(sock, jid, mencionado, idsDeRemitente(msg))) {
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

    const botones = [
      { text: '🪨 Piedra', id: `${prefix}pptjugar piedra` },
      { text: '📄 Papel', id: `${prefix}pptjugar papel` },
      { text: '✂️ Tijera', id: `${prefix}pptjugar tijera` }
    ];

    await sock.sendMessage(jid, {
      text: caja(
        [
          `🥊 @${jugador1.split('@')[0]}  🆚  @${jugador2.split('@')[0]}`,
          '',
          'Toca tu jugada 👇',
          'O escribela: piedra / papel / tijera',
          'El resultado se revela cuando los 2 hayan elegido.'
        ],
        { titulo: '⚔️ DUELO PPT', estilo }
      ),
      mentions: [jugador1, jugador2],
      footer: 'ALEPANDA BOT',
      buttons: botones
    });
  }
};

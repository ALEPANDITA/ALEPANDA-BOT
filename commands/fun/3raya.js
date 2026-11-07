const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { mismaPersona, mismoNumero, idsDeRemitente } = require('../../lib/identidad');
const { verificarGanador, verificarEmpate, jugadaBot, dibujarTablero } = require('../../lib/tresenraya');
const { error: cajaError, advertencia, lista } = require('../../lib/estilo');

const PUNTOS_POR_VICTORIA = 5;

global.__ticTacToe = global.__ticTacToe || {};

const INACTIVIDAD_MS = 15 * 60 * 1000; // una partida sin jugadas por 15 min se descarta sola

function partidaDe(jid) {
  const game = global.__ticTacToe[jid];
  if (game && Date.now() - (game.ultimaJugada || game.createdAt || 0) > INACTIVIDAD_MS) {
    delete global.__ticTacToe[jid];
    return null;
  }
  return game || null;
}

// ¿Quien escribio el mensaje: 'X', 'O' o nadie? Aguanta que el mismo usuario llegue como numero o como @lid
// (se compara primero rapido por numero y, si no, con la ficha del grupo). Lo que aprende lo recuerda en la partida.
async function jugadorDe(sock, jid, msg, game) {
  const ids = idsDeRemitente(msg);
  const simbolos = game.vsBot ? ['X'] : ['X', 'O'];
  game.alias = game.alias || { X: [], O: [] };
  const conocidos = (s) => [game.players[s], ...game.alias[s]];
  for (const s of simbolos) if (mismoNumero(conocidos(s), ids)) return s;
  for (const s of simbolos) {
    if (await mismaPersona(sock, jid, conocidos(s), ids)) {
      game.alias[s].push(...ids);
      return s;
    }
  }
  return null;
}

function otorgarPuntos(ganadorJid) {
  if (!ganadorJid || ganadorJid === 'bot') return;
  const db = leerDB();
  const usuario = getUsuario(db, ganadorJid);
  usuario.tresRayaPuntos = (usuario.tresRayaPuntos || 0) + PUNTOS_POR_VICTORIA;
  usuario.tresRayaVictorias = (usuario.tresRayaVictorias || 0) + 1;
  guardarDB(db);
}

function nombreDe(jid) {
  return jid === 'bot' ? 'el bot 🤖' : `@${jid.split('@')[0]}`;
}

async function enviarTablero(sock, jid, game) {
  const resultado = verificarGanador(game.board);
  const empate = !resultado && verificarEmpate(game.board);
  const mentions = [game.players.X, game.players.O].filter((j) => j !== 'bot');

  let pie;
  if (resultado) {
    const ganadorJid = resultado.simbolo === 'X' ? game.players.X : game.players.O;
    otorgarPuntos(ganadorJid);
    pie = `🏆 Gano ${nombreDe(ganadorJid)} (+${PUNTOS_POR_VICTORIA} puntos)`;
  } else if (empate) {
    pie = '🤝 Empate! Nadie suma puntos';
  } else {
    const turnoJid = game.turn === 'X' ? game.players.X : game.players.O;
    pie = `Turno de ${nombreDe(turnoJid)} (${game.turn === 'X' ? '❌' : '⭕'})`;
  }

  const texto = `🎮 *3 EN RAYA*\n\n${dibujarTablero(game.board)}\n\n${pie}`;
  await sock.sendMessage(jid, { text: texto, mentions });

  if (resultado || empate) {
    delete global.__ticTacToe[jid];
    return true;
  }
  return false;
}

// Pone la ficha del jugador en turno, revisa si termino y, contra el bot, juega el turno del bot
async function jugarCasilla(sock, jid, game, idx) {
  if (game.board[idx] !== null) {
    return sock.sendMessage(jid, { text: advertencia('Esa casilla ya esta ocupada.', { titulo: '3 EN RAYA' }) });
  }

  game.board[idx] = game.turn;
  game.turn = game.turn === 'X' ? 'O' : 'X';
  game.ultimaJugada = Date.now();

  const terminado = await enviarTablero(sock, jid, game);
  if (terminado) return;

  if (game.vsBot && game.turn === 'O') {
    const botIdx = jugadaBot(game.board, 'O', 'X');
    game.board[botIdx] = 'O';
    game.turn = 'X';
    await enviarTablero(sock, jid, game);
  }
}

module.exports = {
  name: '3raya',
  aliases: ['triqui', 'gato', 'tresenraya'],
  category: 'fun',
  description: 'Juega 3 en raya contra otro usuario o contra el bot. Uso: .3raya @usuario | .3raya bot | .3raya <1-9> | .3raya rendirse',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1);
    const input = (partes[0] || '').toLowerCase();
    const game = partidaDe(jid);

    // Sin argumentos: muestra el tablero actual o el menu de ayuda
    if (!input) {
      if (game) return enviarTablero(sock, jid, game);
      return sock.sendMessage(jid, {
        text: lista('3 EN RAYA', [
          `${prefix}3raya @usuario — retar a alguien`,
          `${prefix}3raya bot — jugar contra el bot`,
          `${prefix}3raya <1-9> — hacer un movimiento`,
          `${prefix}3raya rendirse — abandonar`,
          `${prefix}top3raya — ver el ranking`
        ])
      });
    }

    // Rendirse
    if (input === 'rendirse' || input === 'salir') {
      if (!game) {
        return sock.sendMessage(jid, { text: advertencia('No hay ninguna partida activa en este chat.', { titulo: '3 EN RAYA' }) });
      }

      const quien = await jugadorDe(sock, jid, msg, game);
      if (!quien) {
        return sock.sendMessage(jid, { text: advertencia('No eres parte de esta partida.', { titulo: '3 EN RAYA' }) });
      }

      const ganadorJid = quien === 'X' ? game.players.O : game.players.X;
      otorgarPuntos(ganadorJid);
      delete global.__ticTacToe[jid];

      const mentions = [remitente, ganadorJid].filter((j) => j !== 'bot');
      return sock.sendMessage(jid, {
        text: `🏳️ @${remitente.split('@')[0]} se rindio\n🏆 Gano ${nombreDe(ganadorJid)} (+${PUNTOS_POR_VICTORIA} puntos)`,
        mentions
      });
    }

    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    // Retar a alguien o al bot
    if (mencionado || input === 'bot') {
      if (game) {
        return sock.sendMessage(jid, {
          text: advertencia(`Ya hay una partida activa en este chat.\nUsa ${prefix}3raya rendirse para cancelarla.`, { titulo: '3 EN RAYA' })
        });
      }

      const vsBot = input === 'bot';
      if (!vsBot && await mismaPersona(sock, jid, mencionado, idsDeRemitente(msg))) {
        return sock.sendMessage(jid, { text: advertencia('No puedes retarte a ti mismo.', { titulo: '3 EN RAYA' }) });
      }

      global.__ticTacToe[jid] = {
        board: Array(9).fill(null),
        turn: 'X',
        players: { X: remitente, O: vsBot ? 'bot' : mencionado },
        vsBot,
        createdAt: Date.now(),
        ultimaJugada: Date.now()
      };

      return enviarTablero(sock, jid, global.__ticTacToe[jid]);
    }

    // Movimiento (1-9)
    const pos = parseInt(input, 10);
    if (isNaN(pos) || pos < 1 || pos > 9) {
      return sock.sendMessage(jid, { text: cajaError(`Comando invalido. Usa ${prefix}3raya <1-9>`) });
    }

    if (!game) {
      return sock.sendMessage(jid, {
        text: advertencia(`No hay ninguna partida activa.\nUsa ${prefix}3raya @usuario o ${prefix}3raya bot`, { titulo: '3 EN RAYA' })
      });
    }

    const simboloJugador = await jugadorDe(sock, jid, msg, game);
    if (!simboloJugador) {
      return sock.sendMessage(jid, { text: advertencia('No eres parte de esta partida.', { titulo: '3 EN RAYA' }) });
    }

    if (game.turn !== simboloJugador) {
      return sock.sendMessage(jid, { text: advertencia('No es tu turno.', { titulo: '3 EN RAYA' }) });
    }

    await jugarCasilla(sock, jid, game, pos - 1);
  },

  // Jugada escrita sin el comando: con una partida activa basta con mandar el numero (1-9) o responder con el. Lo llama
  // index.js con cada mensaje de texto sin prefijo. Devuelve true solo si el mensaje era una jugada (asi no se come
  // otros mensajes: solo cuenta si quien escribe es jugador de la partida y es su turno).
  manejarNumeroSuelto: async (sock, jid, msg, texto) => {
    if (!/^[1-9]$/.test(String(texto || '').trim())) return false;
    const game = partidaDe(jid);
    if (!game) return false;
    const simbolo = await jugadorDe(sock, jid, msg, game);
    if (!simbolo || game.turn !== simbolo) return false;
    await jugarCasilla(sock, jid, game, parseInt(texto.trim(), 10) - 1);
    return true;
  }
};

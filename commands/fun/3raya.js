const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { mismoUsuario } = require('../../lib/permisos');
const { verificarGanador, verificarEmpate, jugadaBot, dibujarTablero } = require('../../lib/tresenraya');
const { error: cajaError, advertencia, lista } = require('../../lib/estilo');

const PUNTOS_POR_VICTORIA = 5;

global.__ticTacToe = global.__ticTacToe || {};

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
    const game = global.__ticTacToe[jid];

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

      const esJugadorX = mismoUsuario(game.players.X, remitente);
      const esJugadorO = !game.vsBot && mismoUsuario(game.players.O, remitente);

      if (!esJugadorX && !esJugadorO) {
        return sock.sendMessage(jid, { text: advertencia('No eres parte de esta partida.', { titulo: '3 EN RAYA' }) });
      }

      const ganadorJid = esJugadorX ? game.players.O : game.players.X;
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
      if (!vsBot && mismoUsuario(mencionado, remitente)) {
        return sock.sendMessage(jid, { text: advertencia('No puedes retarte a ti mismo.', { titulo: '3 EN RAYA' }) });
      }

      global.__ticTacToe[jid] = {
        board: Array(9).fill(null),
        turn: 'X',
        players: { X: remitente, O: vsBot ? 'bot' : mencionado },
        vsBot,
        createdAt: Date.now()
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

    const esJugadorX = mismoUsuario(game.players.X, remitente);
    const esJugadorO = !game.vsBot && mismoUsuario(game.players.O, remitente);

    if (!esJugadorX && !esJugadorO) {
      return sock.sendMessage(jid, { text: advertencia('No eres parte de esta partida.', { titulo: '3 EN RAYA' }) });
    }

    const simboloJugador = esJugadorX ? 'X' : 'O';
    if (game.turn !== simboloJugador) {
      return sock.sendMessage(jid, { text: advertencia('No es tu turno.', { titulo: '3 EN RAYA' }) });
    }

    const idx = pos - 1;
    if (game.board[idx] !== null) {
      return sock.sendMessage(jid, { text: advertencia('Esa casilla ya esta ocupada.', { titulo: '3 EN RAYA' }) });
    }

    game.board[idx] = simboloJugador;
    game.turn = game.turn === 'X' ? 'O' : 'X';

    const terminado = await enviarTablero(sock, jid, game);
    if (terminado) return;

    if (game.vsBot && game.turn === 'O') {
      const botIdx = jugadaBot(game.board, 'O', 'X');
      game.board[botIdx] = 'O';
      game.turn = 'X';
      await enviarTablero(sock, jid, game);
    }
  }
};

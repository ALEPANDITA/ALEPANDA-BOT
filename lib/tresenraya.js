// Motor del juego 3 en raya (adaptado de un plugin externo al formato de ALEPANDA-BOT).
// No se usa canvas para el tablero: se dibuja con emojis en texto plano, asi no se
// necesita instalar ninguna libreria nueva (canvas es pesada de compilar en Termux).

const LINEAS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const NUMEROS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

function verificarGanador(board) {
  for (const [a, b, c] of LINEAS) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { simbolo: board[a], linea: [a, b, c] };
    }
  }
  return null;
}

function verificarEmpate(board) {
  return board.every((c) => c !== null);
}

// IA simple: 1) gana si puede, 2) bloquea si el rival puede ganar, 3) centro, 4) esquina, 5) libre al azar
function jugadaBot(board, simboloBot, simboloHumano) {
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const copia = [...board];
      copia[i] = simboloBot;
      if (verificarGanador(copia)?.simbolo === simboloBot) return i;
    }
  }
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const copia = [...board];
      copia[i] = simboloHumano;
      if (verificarGanador(copia)?.simbolo === simboloHumano) return i;
    }
  }
  if (board[4] === null) return 4;
  const esquinas = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (esquinas.length) return esquinas[Math.floor(Math.random() * esquinas.length)];
  const libres = board.map((c, i) => (c === null ? i : null)).filter((i) => i !== null);
  return libres[Math.floor(Math.random() * libres.length)];
}

function dibujarTablero(board) {
  const celda = (i) => (board[i] === 'X' ? '❌' : board[i] === 'O' ? '⭕' : NUMEROS[i]);
  const fila = (a, b, c) => `${celda(a)} ┃ ${celda(b)} ┃ ${celda(c)}`;
  return [fila(0, 1, 2), '━━━╋━━━╋━━━', fila(3, 4, 5), '━━━╋━━━╋━━━', fila(6, 7, 8)].join('\n');
}

module.exports = { LINEAS, verificarGanador, verificarEmpate, jugadaBot, dibujarTablero };

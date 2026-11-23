const { marco, aleatorio } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const FILAS = 6;
const PAGOS = [5, 2, 0.7, 0.3, 0.7, 2, 5];
const COLOR = (m) => (m >= 5 ? '🟥' : m >= 2 ? '🟧' : m >= 0.7 ? '🟨' : '⬛');
const BLANCO = '　';
const ANCHO = FILAS * 2 + 1;

function tablero(k, j) {
  const filas = [];
  for (let r = 0; r < FILAS; r++) {
    const celdas = Array(ANCHO).fill(BLANCO);
    for (let i = 0; i <= r; i++) celdas[FILAS - r + 2 * i] = '🔸';
    if (k === r) celdas[FILAS - r + 2 * j] = '🔴';
    filas.push(celdas.join(''));
  }
  const casillas = Array(ANCHO).fill(BLANCO);
  PAGOS.forEach((m, i) => { casillas[2 * i] = k === FILAS && i === j ? '🔴' : COLOR(m); });
  const arriba = Array(ANCHO).fill(BLANCO); if (k === -1) arriba[FILAS] = '🔴';
  return [arriba.join(''), ...filas, casillas.join('')].join('\n');
}

module.exports = {
  name: 'plinko',
  aliases: ['plinco', 'pachinko'],
  category: 'casino',
  description: `Plinko: la bola cae por las clavijas hasta una casilla de 🟥x5, 🟧x2, 🟨x0.7 o ⬛x0.3. Ej: .plinko 100. Minimo $${MINIMO}`,
  _pagos: PAGOS,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const apuesta = leerMonto(texto.trim().split(/\s+/)[1], 0);
    if (!apuesta) return aviso(sock, jid, msg, 'PLINKO', `Uso: ${prefix}plinko <monto>\n• La bola rebota en las clavijas y cae en una casilla: 🟥 x5 · 🟧 x2 · 🟨 x0.7 · ⬛ x0.3\n• Las orillas pagan más, el centro menos\nEj: ${prefix}plinko 100`);

    await correr(sock, jid, msg, {
      titulo: 'PLINKO', apuesta, pausaMs: 800,
      generar: () => {
        let j = 0;
        const camino = [];
        for (let r = 0; r < FILAS; r++) { camino.push(j); j += aleatorio(2); }
        const cabecera = `@${remitente.split('@')[0]} apostó *$${apuesta}*`;
        const leyenda = '🟥 x5 · 🟧 x2 · 🟨 x0.7 · ⬛ x0.3';
        const titulo = '🔴 *PLINKO* 🔴';
        const cuadros = [marco(titulo, [cabecera, '', tablero(-1, 0), leyenda])];
        camino.forEach((p, r) => cuadros.push({ texto: marco(titulo, [cabecera, '', tablero(r, p), leyenda]), ms: 750 }));
        cuadros.push({ texto: marco(titulo, [cabecera, '', tablero(FILAS, j), leyenda]), ms: 900 });
        const m = PAGOS[j];
        const recibido = Math.floor(apuesta * m);
        const detalle = m >= 1 ? `${COLOR(m)} ¡Cayó en *x${m}*! Ganaste *$${recibido - apuesta}*.` : `${COLOR(m)} Cayó en *x${m}*: recuperas *$${recibido}* (perdiste *$${apuesta - recibido}*).`;
        return { cambio: recibido - apuesta, cuadros, detalle };
      }
    });
  }
};

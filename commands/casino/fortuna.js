const { marco, aleatorio } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const RUEDA = [
  ['💀', 0], ['💀', 0], ['💀', 0], ['💰', 1], ['💀', 0], ['💀', 0], ['💎', 2], ['💀', 0],
  ['🪙', 0.5], ['💀', 0], ['💀', 0], ['🍀', 3], ['💀', 0], ['🪙', 0.5], ['💀', 0], ['👑', 5],
  ['💀', 0], ['🪙', 0.5], ['💀', 0], ['💀', 0], ['💀', 0], ['🪙', 0.5], ['🔥', 10], ['💀', 0]
];
const casilla = (i) => RUEDA[((i % RUEDA.length) + RUEDA.length) % RUEDA.length];
const mult = (m) => `${m}x`;

function pantalla(pos, pie) {
  const v = [-2, -1, 0, 1, 2].map((d) => casilla(pos + d));
  const lado = (c) => `${c[0]}${mult(c[1])}`;
  const fila = `${lado(v[0])}  ${lado(v[1])}  ▶ *${lado(v[2])}* ◀  ${lado(v[3])}  ${lado(v[4])}`;
  return marco('🎡 *RUEDA DE LA FORTUNA* 🎡', ['            ▼', fila, '            ▲', '', pie]);
}

module.exports = {
  name: 'fortuna',
  aliases: ['rueda', 'wheel', 'ruedafortuna'],
  category: 'casino',
  description: `Rueda de la fortuna animada: gira y puede dejarte 💀0x, 🪙0.5x, 💰1x, 💎2x, 🍀3x, 👑5x o 🔥10x. Ej: .fortuna 100. Minimo $${MINIMO}`,
  _rueda: RUEDA,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const apuesta = leerMonto(texto.trim().split(/\s+/)[1], 0);
    if (!apuesta) return aviso(sock, jid, msg, 'FORTUNA', `Uso: ${prefix}fortuna <monto>\n• Gira la rueda y cobras lo que marque: 💀 0x · 🪙 0.5x · 💰 1x · 💎 2x · 🍀 3x · 👑 5x · 🔥 10x\nEj: ${prefix}fortuna 100`);

    await correr(sock, jid, msg, {
      titulo: 'FORTUNA', apuesta,
      generar: () => {
        const final = aleatorio(RUEDA.length);
        const pasos = 26;
        const cuadros = [];
        for (let k = 0; k <= pasos; k++) {
          const pos = final - pasos + k;
          const ms = k < 12 ? 320 : k < 20 ? 520 : k < 24 ? 800 : k === 24 ? 1100 : k === 25 ? 1500 : 1700;
          const pie = k < pasos - 3 ? `Girando${'.'.repeat(1 + (k % 3))} 🌀` : k < pasos ? '¡Ya casi se detiene! 😰' : '¡Se detuvo! 🎯';
          cuadros.push({ texto: pantalla(pos, `@${remitente.split('@')[0]} apostó *$${apuesta}*\n${pie}`), ms });
        }
        const [emoji, m] = casilla(final);
        const recibido = Math.floor(apuesta * m);
        const detalle = m === 0 ? `${emoji} Cayó en *0x*... La casa se queda tu apuesta.\nPerdiste *$${apuesta}*.`
          : recibido > apuesta ? `${emoji} ¡Cayó en *${mult(m)}*! Ganaste *$${recibido - apuesta}*.`
          : recibido === apuesta ? `${emoji} Cayó en *1x*: recuperas tu apuesta.`
          : `${emoji} Cayó en *${mult(m)}*: recuperas *$${recibido}* (perdiste *$${apuesta - recibido}*).`;
        return { cambio: recibido - apuesta, cuadros, detalle };
      }
    });
  }
};

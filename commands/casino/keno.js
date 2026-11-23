const { marco, mezclar } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const TOTAL = 20;
const ELIGES = 5;
const SALEN = 8;
const PAGOS = { 0: 0, 1: 0, 2: 0.3, 3: 1.5, 4: 5.5, 5: 45 };
const dos = (n) => String(n).padStart(2, '0');

function pantalla(elegidos, salidos, pie) {
  const lista = elegidos.map((n) => (salidos.includes(n) ? `✅${dos(n)}` : dos(n))).join('  ');
  const bolas = salidos.length ? salidos.map(dos).join(' · ') : '—';
  const aciertos = elegidos.filter((n) => salidos.includes(n)).length;
  return marco('🎱 *KENO* 🎱', [`🎟️ Tus números: ${lista}`, '', `🎰 Salen (${salidos.length}/${SALEN}): ${bolas}`, `🎯 Aciertos: *${aciertos}*`, '', pie]);
}

module.exports = {
  name: 'keno',
  aliases: ['bingo5'],
  category: 'casino',
  description: `Keno: eliges 5 números del 1 al 20 y salen 8. 2 aciertos x0.3 · 3 x1.5 · 4 x5.5 · 5 x45. Ej: .keno 100 3 7 11 15 19 (sin números te los doy yo). Minimo $${MINIMO}`,
  _pagos: PAGOS,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1);
    const apuesta = leerMonto(partes[0], 0);
    const nums = partes.slice(1).map((p) => parseInt(p, 10));
    const uso = `Uso: ${prefix}keno <monto> [5 números del 1 al ${TOTAL}]\n• Salen ${SALEN} números. Pago: 2 aciertos x0.3 · 3 x1.5 · 4 x5.5 · 5 x45\n• Si no pones números, te los doy al azar\nEj: ${prefix}keno 100 3 7 11 15 19`;
    if (!apuesta) return aviso(sock, jid, msg, 'KENO', uso);

    let elegidos;
    if (!nums.length) elegidos = mezclar(Array.from({ length: TOTAL }, (_, i) => i + 1)).slice(0, ELIGES).sort((a, b) => a - b);
    else {
      const validos = nums.every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL);
      if (!validos || nums.length !== ELIGES || new Set(nums).size !== ELIGES) return aviso(sock, jid, msg, 'KENO', `Elige exactamente *${ELIGES} números distintos* del 1 al ${TOTAL}.\n\n${uso}`);
      elegidos = [...nums].sort((a, b) => a - b);
    }

    await correr(sock, jid, msg, {
      titulo: 'KENO', apuesta, pausaMs: 1000,
      generar: () => {
        const orden = mezclar(Array.from({ length: TOTAL }, (_, i) => i + 1)).slice(0, SALEN);
        const cuadros = [pantalla(elegidos, [], `@${remitente.split('@')[0]} apostó *$${apuesta}*\nSe mezclan las bolas... 🌀`)];
        for (let k = 1; k <= SALEN; k++) {
          const sale = orden.slice(0, k);
          const hit = elegidos.includes(orden[k - 1]);
          cuadros.push({ texto: pantalla(elegidos, sale, hit ? `🔔 ¡El *${dos(orden[k - 1])}* es tuyo!` : `Sale el ${dos(orden[k - 1])}...`), ms: hit ? 1300 : 1000 });
        }
        const aciertos = elegidos.filter((n) => orden.includes(n)).length;
        const m = PAGOS[aciertos];
        const recibido = Math.floor(apuesta * m);
        const detalle = `🎯 Aciertos: *${aciertos}* de ${ELIGES}\n` + (m === 0 ? `Sin premio. Perdiste *$${apuesta}*.` : recibido > apuesta ? `¡Pagó *x${m}*! Ganaste *$${recibido - apuesta}*.` : `Pagó x${m}: recuperas *$${recibido}* (perdiste *$${apuesta - recibido}*).`);
        return { cambio: recibido - apuesta, cuadros, detalle };
      }
    });
  }
};

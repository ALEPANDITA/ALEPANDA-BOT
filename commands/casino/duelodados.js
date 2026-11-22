const { manejarDuelo } = require('../../lib/duelos');
const { marco, aleatorio } = require('../../lib/cuadros');

const TITULO = 'DUELO DE DADOS';
const CARA = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const tirar = () => [1 + aleatorio(6), 1 + aleatorio(6)];
const vista = (d) => `${CARA[d[0] - 1]} ${CARA[d[1] - 1]}  = *${d[0] + d[1]}*`;

// Cada quien tira 2 dados; gana la suma mas alta (si empatan se vuelve a tirar)
function jugar(a, b, monto) {
  let d1; let d2; let rondas = 0;
  do { d1 = tirar(); d2 = tirar(); rondas++; } while (d1[0] + d1[1] === d2[0] + d2[1] && rondas < 20);
  const s1 = d1[0] + d1[1]; const s2 = d2[0] + d2[1];
  const ganador = s1 === s2 ? aleatorio(2) : (s1 > s2 ? 0 : 1);
  const cab = `${a.tag} 🆚 ${b.tag}  ·  💰 Bote $${monto * 2}`;
  const rod = (i) => marco(`🎲 ${TITULO} 🎲`, [cab, '', `${a.tag}: ${CARA[i % 6]} ${CARA[(i + 2) % 6]}`, `${b.tag}: ${CARA[(i + 4) % 6]} ${CARA[(i + 1) % 6]}`, '', `Lanzando${'.'.repeat(1 + (i % 3))}`]);
  const cuadros = [rod(0), rod(1), rod(2),
    marco(`🎲 ${TITULO} 🎲`, [cab, '', `${a.tag}: ${vista(d1)}`, `${b.tag}: 🎲 🎲 ...`]),
    marco(`🎲 ${TITULO} 🎲`, [cab, '', `${a.tag}: ${vista(d1)}`, `${b.tag}: ${vista(d2)}`])];
  return { ganador, cuadros, resumen: rondas > 1 ? `🔁 Hubo empate y se volvió a tirar (${rondas} rondas).` : '' };
}

module.exports = {
  name: 'duelodados',
  aliases: ['dd', 'dadosduelo'],
  category: 'casino',
  description: 'Duelo de dados 1 vs 1: cada quien tira 2 dados y gana la suma más alta. Ej: .duelodados @amigo 200',
  execute: (sock, jid, msg, ctx) => manejarDuelo(sock, jid, msg, ctx, {
    comando: 'duelodados', titulo: TITULO, emoji: '🎲', minimo: 10, jugar,
    reglas: '🎲 *Duelo de dados*: cada quien tira 2 dados, gana la suma más alta y se lleva las dos apuestas.'
  })
};

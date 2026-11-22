const { manejarDuelo } = require('../../lib/duelos');
const { marco, aleatorio } = require('../../lib/cuadros');

const TITULO = 'RULETA RUSA';

// Un revolver de 6 camaras con UNA bala: se turnan para jalar el gatillo y pierde quien reciba el disparo
function jugar(a, b, monto) {
  const bala = aleatorio(6);          // en que jalada (0 a 5) sale el disparo
  const primero = aleatorio(2);       // quien jala primero (0 = retador, 1 = rival)
  const nombres = [a.tag, b.tag];
  const perdedor = (primero + bala) % 2;
  const cabecera = `${a.tag} 🆚 ${b.tag}  ·  💰 Bote $${monto * 2}`;
  const tambor = (hechos, fin) => '[ ' + Array.from({ length: 6 }, (_, i) => (i < hechos ? '⭕' : i === hechos && fin ? '💥' : '⚪')).join(' ') + ' ]';
  const cuadros = [
    marco(`🔫 ${TITULO} 🔫`, [cabecera, '', 'Se carga UNA sola bala... 🔫']),
    marco(`🔫 ${TITULO} 🔫`, [cabecera, '', 'Se gira el tambor 🌀🌀🌀', tambor(0, false)])
  ];
  const historial = [];
  for (let t = 0; t <= bala; t++) {
    const quien = (primero + t) % 2;
    cuadros.push(marco(`🔫 ${TITULO} 🔫`, [cabecera, '', ...historial, `🎯 Turno de ${nombres[quien]}...`, 'Aprieta el gatillo 😰', tambor(t, false)]));
    if (t < bala) {
      historial.push(`${t + 1}️⃣ ${nombres[quien]} — *click* 😮‍💨 vacío`);
    } else {
      cuadros.push(marco(`💥 ${TITULO} 💥`, [cabecera, '', ...historial, `${t + 1}️⃣ ${nombres[quien]} — 💥 *¡BANG!*`, tambor(t, true)]));
    }
  }
  return { ganador: 1 - perdedor, cuadros, resumen: `💥 ¡BANG! ${nombres[perdedor]} recibió el disparo.` };
}

module.exports = {
  name: 'ruletarusa',
  aliases: ['rr', 'rusa'],
  category: 'casino',
  description: 'Ruleta rusa 1 vs 1: retas a alguien con una apuesta, si acepta el bot les quita el dinero y el que sobrevive se lleva el bote. Ej: .ruletarusa @amigo 200',
  execute: (sock, jid, msg, ctx) => manejarDuelo(sock, jid, msg, ctx, {
    comando: 'ruletarusa', titulo: TITULO, emoji: '🔫', minimo: 10, jugar,
    reglas: '🔫 *Ruleta rusa*: un revólver con 1 bala en 6 cámaras. Se turnan para jalar el gatillo; quien reciba el disparo pierde y el otro se lleva las dos apuestas.'
  })
};

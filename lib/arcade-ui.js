// Diseño visual del ARCADE: misma firma que el resto de ALEPANDA BOT (panda 🐼, huellas 🐾, marco ╭━ ⬣)
// pero con su toque de joystick 🕹️ y bambú 🎋. Si el modo Halloween del bot esta activo, manda el marco de Halloween
// (igual que en todos los demas comandos).
'use strict';

const { caja, halloweenActivo } = require('./estilo');

const PIE = 'ALEPANDA ARCADE';
const REGLA = '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈';

// lineas: arreglo de textos. '' = renglon en blanco. REGLA = separador fino.
function marco(lineas, { titulo, emoji = '🕹️', pie = PIE } = {}) {
  if (halloweenActivo()) return caja(lineas, { titulo, pie });
  const partes = [titulo ? `╭━━━〔 🐼 *${titulo}* ${emoji} 〕━━━⬣` : '╭━━━━━━━━━━━━━━━━━━━━━━⬣'];
  for (const l of lineas) partes.push(l === '' ? '┃' : `┃ ${l}`);
  partes.push('┣━━━━━━━━━━━━━━━━━━━━━━⬣', `┃ 🐾 ${pie}`, '╰━━━━━━━━━━━━━━━━━━━━━━⬣');
  return partes.join('\n');
}

const fmt = (n) => Number(n).toLocaleString('es-MX');

// Bloque de premios (lo usan .arcade y .flappy)
function lineasPremios(cfg) {
  return [
    `🪙 Moneda de oro ➜ *$${fmt(cfg.valorMoneda)}*`,
    '🧱 Tubería esquivada ➜ *$1*',
    `🔒 Tope: *$${fmt(cfg.maxPorCobro)}* por cobro · *$${fmt(cfg.maxDiario)}* al día`
  ];
}

module.exports = { marco, fmt, lineasPremios, REGLA, PIE };

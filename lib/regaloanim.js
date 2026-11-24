const { marco, elegir } = require('./cuadros');

const PARTICULAS = {
  chico: ['🌸', '💗', '✨', '🎀'],
  medio: ['💖', '✨', '💕', '🌹', '💫'],
  grande: ['🎉', '🎊', '✨', '💖', '🎈'],
  legendario: ['🎆', '🎇', '✨', '🌟', '💥', '👑']
};
const TITULO = {
  chico: '🎁 *REGALO* 🎁',
  medio: '💝 *REGALO ESPECIAL* 💝',
  grande: '🎉 *¡REGALAZO!* 🎉',
  legendario: '🎆 *REGALO LEGENDARIO* 🎆'
};
const PAUSA = { chico: 900, medio: 1000, grande: 1100, legendario: 1200 };

const barra = (p, largo = 10) => { const l = Math.round(Math.max(0, Math.min(1, p)) * largo); return '▰'.repeat(l) + '▱'.repeat(largo - l); };
const lluvia = (nivel, filas = 3, celdas = 7, dens = 0.55) => Array.from({ length: filas }, () =>
  Array.from({ length: celdas }, () => (Math.random() < dens ? elegir(PARTICULAS[nivel]) : '　')).join('')).join('\n');
const descubrir = (nombre, f) => {
  const n = nombre.length; const k = Math.ceil(n * f);
  return [...nombre].map((c, i) => (i < k || c === ' ' ? c : '▒')).join('');
};

function crearCuadros({ regalo, nivel, de, para, frase, reaccion, efecto, costo, encabezado, preparacion }) {
  const t = TITULO[nivel];
  const ms = PAUSA[nivel];
  const nombre = regalo.nombre.toUpperCase();
  const f = (lineas, pausa = ms) => ({ texto: marco(t, lineas), ms: pausa });
  const cab = `${de}  ➜  ${para}`;
  const c = [];

  const prep = preparacion || ['Preparando...', 'Envolviendo el regalo...', 'Poniendo el moño...'];
  c.push(f([cab, '', '           🎁', '', `${barra(0)}  ${prep[0]}`]));
  c.push(f([cab, '', '         📦 ➕ 🎀', '', `${barra(0.35)}  ${prep[1]}`]));
  c.push(f([cab, '', '        📦🎀 ✨', '', `${barra(0.7)}  ${prep[2]}`]));

  if (nivel === 'chico') {
    c.push(f([cab, '', lluvia(nivel, 2), '        🎁 💌 🎁', '', `${barra(1)}  ¡Entregando!`], 800));
    c.push(f([cab, '', lluvia(nivel, 1), `       ${regalo.emoji}  ${descubrir(nombre, 0.5)}`, lluvia(nivel, 1), '', '¡Ya casi!'], 900));
  }

  if (nivel === 'medio') {
    c.push(f([cab, '', '🚚💨 · · · · · ·', `${barra(0.9)}  En camino a ${para}...`]));
    c.push(f([cab, '', lluvia(nivel, 2), '       🔔 ¡TOC TOC! 🔔', lluvia(nivel, 1), '', `¡Llegó un regalo para ${para}!`]));
    c.push(f([cab, '', lluvia(nivel, 2), `     ${regalo.emoji}  ${descubrir(nombre, 0.6)}  ${regalo.emoji}`, lluvia(nivel, 2), '', '💖 Abriendo...']));
  }

  if (nivel === 'grande') {
    c.push(f([cab, '', '🔔 ¡ATENCIÓN, GRUPO! 🔔', '', `${de} trae algo ENORME`, `para ${para}...`]));
    for (const n of ['3️⃣', '2️⃣', '1️⃣']) c.push(f([cab, '', lluvia(nivel, 2), `            ${n}`, lluvia(nivel, 2), '', '🥁 Tambores...'], 800));
    c.push(f([cab, '', lluvia(nivel, 3), `   ${regalo.emoji}  ${descubrir(nombre, 0.35)}`, lluvia(nivel, 3)]));
    c.push(f([cab, '', lluvia(nivel, 3), `   ${regalo.emoji}  ${descubrir(nombre, 0.75)}`, lluvia(nivel, 3)]));
  }

  if (nivel === 'legendario') {
    c.push(f([cab, '', '⚠️ ¡¡ALERTA GENERAL!! ⚠️', '', 'Algo nunca visto está llegando...', '🌌🌌🌌🌌🌌🌌🌌'], 1400));
    c.push(f([cab, '', '🌌        🌠        🌌', '      🌠   🌌   🌠', '🌌        🌠        🌌', '', '🥁 El cielo se oscurece...'], 1300));
    for (const n of ['5️⃣', '4️⃣', '3️⃣', '2️⃣', '1️⃣']) c.push(f([cab, '', lluvia(nivel, 2, 7, 0.4), `            ${n}`, lluvia(nivel, 2, 7, 0.4), '', '🥁🥁🥁'], 750));
    c.push(f([cab, '', lluvia(nivel, 3, 7, 0.7), `  ${regalo.emoji}  ${descubrir(nombre, 0.3)}`, lluvia(nivel, 3, 7, 0.7), '', '🎆 ¡Algo viene!'], 1100));
    c.push(f([cab, '', lluvia(nivel, 3, 7, 0.8), `  ${regalo.emoji}  ${descubrir(nombre, 0.65)}`, lluvia(nivel, 3, 7, 0.8), '', '🎇 ¡Cada vez más cerca!'], 1100));
    c.push(f([cab, '', lluvia(nivel, 3, 7, 0.9), `  ${regalo.emoji}  ${descubrir(nombre, 1)}`, lluvia(nivel, 3, 7, 0.9), '', '💥 ¡¡BOOOOM!! 💥'], 1300));
  }

  const adorno = `${regalo.emoji} ${regalo.emoji} ${regalo.emoji}`;
  encabezado = encabezado || { chico: '🌸 *¡SORPRESA!* 🌸', medio: '💖 *¡REGALO DE AMOR!* 💖', grande: '🎉 *¡REGALAZO DE LUJO!* 🎉', legendario: '👑 *¡¡REGALO LEGENDARIO!!* 👑' }[nivel];
  c.push({
    texto: [
      efecto, '', encabezado, '',
      `${de} le manda a ${para}:`, adorno, `*${nombre}*`, adorno, '',
      `_${frase}_`, '', reaccion, '', efecto, `💸 Costo: ${costo}`
    ].join('\n'),
    ms: ms
  });
  return c;
}

module.exports = { crearCuadros, PAUSA, barra, lluvia, descubrir };

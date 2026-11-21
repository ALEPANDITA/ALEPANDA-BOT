const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, aleatorio } = require('../../lib/cuadros');

const MINIMO = 10;
const META = 10;                 // casillas hasta la meta
const RETORNO = 4.5;             // si tu corredor gana recibes 4.5 veces lo apostado (5 corredores = 20% cada uno, paga ~90%)
const CORREDORES = ['🐎', '🦄', '🐕', '🐇', '🐢'];
const NUMEROS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

// Simula toda la carrera: cada turno cada corredor avanza 0 a 3 casillas (todos con la misma probabilidad)
function simular() {
  const pos = CORREDORES.map(() => 0);
  const turnos = [];
  let ganador = null;
  for (let t = 0; t < 20 && ganador === null; t++) {
    for (let i = 0; i < pos.length; i++) pos[i] += aleatorio(4);
    turnos.push([...pos]);
    const llegaron = pos.map((p, i) => (p >= META ? i : -1)).filter((i) => i >= 0);
    if (llegaron.length) {
      const mejor = Math.max(...llegaron.map((i) => pos[i]));
      const empatados = llegaron.filter((i) => pos[i] === mejor);
      ganador = empatados[aleatorio(empatados.length)];
    }
  }
  if (ganador === null) ganador = aleatorio(CORREDORES.length);
  return { turnos, ganador };
}

function pista(pos, elegido, ganador) {
  return pos.map((p, i) => {
    const c = Math.min(p, META);
    const marca = i === elegido ? ' ⭐' : '';
    const corona = ganador === i ? ' 🏆' : '';
    return `${NUMEROS[i]} ${'·'.repeat(c)}${CORREDORES[i]}${'·'.repeat(META - c)}🏁${marca}${corona}`;
  });
}

module.exports = {
  name: 'carrera',
  aliases: ['race', 'caballos'],
  category: 'casino',
  description: `Carrera de 5 corredores: elige uno del 1 al 5 y si gana recibes x4.5. Ej: .carrera 100 3. Minimo $${MINIMO}`,
  _simular: simular,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1);
    const nums = partes.filter((p) => /^\d+$/.test(p)).map((p) => parseInt(p, 10));
    const eleccion = nums.length >= 2 ? nums.find((n, i) => i > 0 && n >= 1 && n <= 5) : null;
    const apuesta = nums[0];

    if (!eleccion || !apuesta) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}carrera <monto> <corredor 1-5>\n${CORREDORES.map((c, i) => `${NUMEROS[i]} ${c}`).join('  ')}\n• Si tu corredor gana recibes x${RETORNO} lo apostado\nEj: ${prefix}carrera 100 3`, { titulo: 'CARRERA', estilo: 'gamer' }) }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'CARRERA', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'CARRERA', estilo: 'gamer' }) }, { quoted: msg });

    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'CARRERA', estilo: 'gamer' }) }, { quoted: msg });

      const idx = eleccion - 1;
      const { turnos, ganador } = simular();
      const gano = ganador === idx;
      const cambio = gano ? Math.floor(apuesta * RETORNO) - apuesta : -apuesta;
      usuario.saldo += cambio;
      guardarDB(db);

      const yo = `@${remitente.split('@')[0]}`;
      const cabecera = `${yo} apuesta *$${apuesta}* al ${NUMEROS[idx]} ${CORREDORES[idx]}`;
      const titulo = '🏁 *CARRERA* 🏁';
      const cuadros = [
        marco(titulo, [cabecera, '', ...pista(CORREDORES.map(() => 0), idx, null), '', '🚦 Preparados...']),
        { texto: marco(titulo, [cabecera, '', ...pista(CORREDORES.map(() => 0), idx, null), '', '🚦 ¡LISTOS!']), ms: 900 },
        ...turnos.map((pos, t) => ({ texto: marco(titulo, [cabecera, '', ...pista(pos, idx, null), '', t === turnos.length - 1 ? '🏁 ¡Cruzan la meta!' : '💨 ¡Van corriendo!']), ms: 1100 }))
      ];
      const ultimo = turnos[turnos.length - 1];
      const linea = [cabecera, '', ...pista(ultimo, idx, ganador), '', `🏆 Ganó el ${NUMEROS[ganador]} ${CORREDORES[ganador]}`,
        gano ? `¡Ganaste *$${cambio}*!` : `Perdiste *$${apuesta}*.`, `Saldo actual: *$${usuario.saldo}*`].join('\n');
      const final = gano ? exito(linea, { titulo: 'CARRERA', estilo: 'gamer' }) : cajaError(linea, { titulo: 'CARRERA', estilo: 'gamer' });

      await reproducir(sock, jid, [...cuadros, { texto: final }], { quoted: msg, pausaMs: 1100, mentions: [remitente] });
    } finally {
      liberar(remitente);
    }
  }
};

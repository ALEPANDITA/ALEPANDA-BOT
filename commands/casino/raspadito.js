const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, sorteo, mezclar } = require('../../lib/cuadros');

const MINIMO = 10;
const OCULTO = '⬜';
const SIMBOLOS = ['🍒', '⭐', '🍀', '💎', '🍋'];
// Premios: encuentra 3 iguales. El 🍋 nunca da premio. "peso" son probabilidades (suman 100). Paga ~94% en promedio.
const PREMIOS = [
  { peso: 70, simbolo: null, retorno: 0 },
  { peso: 18, simbolo: '🍒', retorno: 1.5 },
  { peso: 8, simbolo: '⭐', retorno: 3 },
  { peso: 3, simbolo: '🍀', retorno: 6 },
  { peso: 1, simbolo: '💎', retorno: 25 }
];

// Arma el tablero 3x3. Con premio: exactamente 3 simbolos iguales (los demas nunca se repiten 3 veces)
function generarTablero(simbolo) {
  if (simbolo) {
    const resto = mezclar(SIMBOLOS.filter((s) => s !== simbolo).flatMap((s) => [s, s])).slice(0, 6);
    return mezclar([simbolo, simbolo, simbolo, ...resto]);
  }
  return mezclar(SIMBOLOS.flatMap((s) => [s, s])).slice(0, 9);
}

function resolver() {
  const premio = sorteo(PREMIOS);
  return { premio, tablero: generarTablero(premio.simbolo) };
}

function dibujar(tablero, reveladas, resaltar) {
  const filas = [];
  for (let f = 0; f < 3; f++) {
    const celdas = [0, 1, 2].map((c) => {
      const i = f * 3 + c;
      return i < reveladas ? tablero[i] : OCULTO;
    });
    filas.push(`     ${celdas.join(' ')}`);
  }
  return resaltar ? [...filas, '', `     ✨ ${resaltar} ✨`] : filas;
}

module.exports = {
  name: 'raspadito',
  aliases: ['raspa', 'scratch', 'rasca'],
  category: 'casino',
  description: `Boleto para raspar: encuentra 3 simbolos iguales. 🍒 x1.5 · ⭐ x3 · 🍀 x6 · 💎 x25. Ej: .raspadito 100. Minimo $${MINIMO}`,
  _resolver: resolver,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const apuesta = parseInt(texto.trim().split(/\s+/)[1], 10);

    if (!apuesta || apuesta <= 0) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}raspadito <monto>\n• Encuentra 3 simbolos iguales en el boleto\n• 🍒 x1.5 · ⭐ x3 · 🍀 x6 · 💎 x25\nEj: ${prefix}raspadito 100`, { titulo: 'RASPADITO', estilo: 'gamer' }) }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'RASPADITO', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'RASPADITO', estilo: 'gamer' }) }, { quoted: msg });

    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'RASPADITO', estilo: 'gamer' }) }, { quoted: msg });

      const { premio, tablero } = resolver();
      const gano = !!premio.simbolo;
      const cambio = gano ? Math.floor(apuesta * premio.retorno) - apuesta : -apuesta;
      usuario.saldo += cambio;
      guardarDB(db);

      const yo = `@${remitente.split('@')[0]}`;
      const cabecera = `${yo} compra un boleto de *$${apuesta}*`;
      const titulo = '🎟️ *RASPADITO* 🎟️';
      const cuadros = [{ texto: marco(titulo, [cabecera, '', ...dibujar(tablero, 0), '', '🪙 Raspando...']), ms: 900 }];
      for (let n = 1; n <= 9; n++) cuadros.push({ texto: marco(titulo, [cabecera, '', ...dibujar(tablero, n), '', n < 9 ? '🪙 Raspando...' : '🔎 Revisando el boleto...']), ms: 800 });
      const linea = [cabecera, '', ...dibujar(tablero, 9, gano ? `¡TRES ${premio.simbolo}!` : 'Sin premio'), '',
        gano ? `¡Ganaste *$${cambio}*! (x${premio.retorno})` : `Perdiste *$${apuesta}*.`, `Saldo actual: *$${usuario.saldo}*`].join('\n');
      const final = gano ? exito(linea, { titulo: 'RASPADITO', estilo: 'gamer' }) : cajaError(linea, { titulo: 'RASPADITO', estilo: 'gamer' });

      await reproducir(sock, jid, [...cuadros, { texto: final }], { quoted: msg, pausaMs: 800, mentions: [remitente] });
    } finally {
      liberar(remitente);
    }
  }
};

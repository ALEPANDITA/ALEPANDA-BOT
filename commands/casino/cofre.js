const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, sorteo } = require('../../lib/cuadros');

const MINIMO = 10;
// Lo que recibes de vuelta por lo apostado. "peso" son probabilidades (suman 100). Paga ~90% en promedio.
const CONTENIDO = [
  { peso: 50, retorno: 0, emoji: '🕸️', nombre: 'Estaba vacío' },
  { peso: 24, retorno: 0.5, emoji: '🪙', nombre: 'Unas monedas sueltas' },
  { peso: 16, retorno: 1.5, emoji: '💰', nombre: 'Una bolsa de oro' },
  { peso: 7, retorno: 3, emoji: '💎', nombre: 'Un diamante' },
  { peso: 2.5, retorno: 8, emoji: '👑', nombre: 'La corona real' },
  { peso: 0.5, retorno: 25, emoji: '🏆', nombre: '¡EL TESORO LEGENDARIO!' }
];

module.exports = {
  name: 'cofre',
  aliases: ['chest', 'tesoro'],
  category: 'casino',
  description: `Abre un cofre misterioso: puede estar vacio o traer hasta x25. Ej: .cofre 100. Minimo $${MINIMO}`,
  _contenido: CONTENIDO,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const apuesta = parseInt(texto.trim().split(/\s+/)[1], 10);

    if (!apuesta || apuesta <= 0) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}cofre <monto>\n• Puede estar vacio 🕸️ o traer 🪙 x0.5 · 💰 x1.5 · 💎 x3 · 👑 x8 · 🏆 x25\nEj: ${prefix}cofre 100`, { titulo: 'COFRE', estilo: 'gamer' }) }, { quoted: msg });
    }
    if (apuesta < MINIMO) return sock.sendMessage(jid, { text: cajaError(`La apuesta minima es *$${MINIMO}*.`, { titulo: 'COFRE', estilo: 'gamer' }) }, { quoted: msg });
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: advertencia('Espera a que termine tu jugada anterior. ⏳', { titulo: 'COFRE', estilo: 'gamer' }) }, { quoted: msg });

    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      if (usuario.saldo < apuesta) return sock.sendMessage(jid, { text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'COFRE', estilo: 'gamer' }) }, { quoted: msg });

      const premio = sorteo(CONTENIDO);
      const recibido = Math.floor(apuesta * premio.retorno);
      const cambio = recibido - apuesta;
      usuario.saldo += cambio;
      guardarDB(db);

      const yo = `@${remitente.split('@')[0]}`;
      const cabecera = `${yo} paga *$${apuesta}* por abrir un cofre`;
      const titulo = '🧰 *COFRE MISTERIOSO* 🧰';
      const escena = (arte, pie) => marco(titulo, [cabecera, '', ...arte, '', pie]);
      const cuadros = [
        escena(['', '        🧰', ''], '🌑 Aparece un cofre en la oscuridad...'),
        escena(['', '      🧰 ❓', ''], '🗝️ Metes la llave...'),
        escena(['', '     ⟪ 🧰 ⟫', ''], '😬 El cofre empieza a temblar...'),
        escena(['', '    ⟪⟪ 🧰 ⟫⟫', '      💥'], '😨 ¡Tiembla más fuerte!'),
        escena(['     ✨  ✨', '        🔓', '     ✨  ✨'], '🔓 ¡Se abre!'),
        escena(['     ✨  ✨', `        ${premio.emoji}`, '     ✨  ✨'], `${premio.nombre}`)
      ];
      const detalle = premio.retorno === 0 ? `Perdiste *$${apuesta}*.`
        : cambio >= 0 ? `Recibes *$${recibido}* (x${premio.retorno}). ¡Ganaste *$${cambio}*!` : `Recibes *$${recibido}* (x${premio.retorno}). Perdiste *$${-cambio}*.`;
      const linea = [cabecera, '', `${premio.emoji} ${premio.nombre}`, detalle, `Saldo actual: *$${usuario.saldo}*`].join('\n');
      const final = cambio >= 0 ? exito(linea, { titulo: 'COFRE', estilo: 'gamer' }) : cajaError(linea, { titulo: 'COFRE', estilo: 'gamer' });

      await reproducir(sock, jid, [...cuadros, { texto: final }], { quoted: msg, pausaMs: 1100, mentions: [remitente] });
    } finally {
      liberar(remitente);
    }
  }
};

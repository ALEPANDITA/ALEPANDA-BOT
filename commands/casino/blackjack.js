const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');
const { reproducir, marco, ocupar, liberar, mezclar } = require('../../lib/cuadros');

const MINIMO = 10;
const EXPIRA_MS = 3 * 60 * 1000;     // si no juegas en 3 minutos, el bot te planta solo
const partidas = new Map();          // jugador -> partida en curso
const RANGOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const PALOS = ['♠️', '♥️', '♦️', '♣️'];
const TITULO = '🃏 BLACKJACK 🃏';

const mazoNuevo = () => mezclar(Array.from({ length: 52 }, (_, i) => ({ r: i % 13, p: Math.floor(i / 13) })));
const valor = (c) => (c.r === 0 ? 11 : c.r >= 10 ? 10 : c.r + 1);
function total(mano) {
  let t = mano.reduce((s, c) => s + valor(c), 0); let ases = mano.filter((c) => c.r === 0).length;
  while (t > 21 && ases > 0) { t -= 10; ases--; }
  return t;
}
const txt = (mano) => mano.map((c) => `${RANGOS[c.r]}${PALOS[c.p]}`).join('  ');
const esBJ = (mano) => mano.length === 2 && total(mano) === 21;

function mesa(p, ocultarCasa, pie) {
  return marco(TITULO, [
    `💰 Apuesta: *$${p.apuesta}*`, '',
    `🧑 Tú: ${txt(p.jugador)}  → *${total(p.jugador)}*`,
    ocultarCasa ? `🏦 Casa: ${txt([p.casa[0]])}  🂠` : `🏦 Casa: ${txt(p.casa)}  → *${total(p.casa)}*`,
    '', pie]);
}

// La casa juega (pide hasta 17), se paga y se muestra todo con cuadros
async function resolver(sock, jid, msg, remitente, db, usuario, p, previo) {
  const cuadros = [];
  if (!esBJ(p.jugador) && total(p.jugador) <= 21) {
    cuadros.push(mesa(p, false, '🏦 La casa muestra su carta...'));
    while (total(p.casa) < 17) { p.casa.push(p.mazo.pop()); cuadros.push(mesa(p, false, '🏦 La casa pide carta...')); }
  }
  const tj = total(p.jugador); const tc = total(p.casa);
  let devuelto = 0; let veredicto;
  if (tj > 21) veredicto = '💥 Te pasaste de 21. Pierdes tu apuesta.';
  else if (esBJ(p.jugador) && !esBJ(p.casa)) { devuelto = p.apuesta + Math.floor(p.apuesta * 1.5); veredicto = '🎉 ¡BLACKJACK! Pagan 3 a 2.'; }
  else if (tc > 21) { devuelto = p.apuesta * 2; veredicto = '🏦 La casa se pasó. ¡Ganas!'; }
  else if (tj > tc) { devuelto = p.apuesta * 2; veredicto = '✅ Le ganas a la casa.'; }
  else if (tj === tc) { devuelto = p.apuesta; veredicto = '🤝 Empate: te devuelven tu apuesta.'; }
  else veredicto = '❌ La casa gana.';
  usuario.saldo += devuelto;
  guardarDB(db);
  partidas.delete(remitente);
  const neto = devuelto - p.apuesta;
  const resultado = `${previo ? previo + '\n' : ''}${veredicto}\n${neto > 0 ? `Ganaste *$${neto}*` : neto === 0 ? 'Sin ganancia ni pérdida' : `Perdiste *$${-neto}*`}\n💳 Saldo: *$${usuario.saldo}*`;
  const final = neto >= 0 ? exito(`${mesa(p, false, '')}\n${resultado}`, { titulo: 'BLACKJACK', estilo: 'gamer' }) : cajaError(`${mesa(p, false, '')}\n${resultado}`, { titulo: 'BLACKJACK', estilo: 'gamer' });
  await reproducir(sock, jid, [...cuadros, { texto: final }], { quoted: msg, pausaMs: 1000, mentions: [remitente] });
}

module.exports = {
  name: 'blackjack',
  aliases: ['bj', '21', 'pedir', 'plantarse', 'hit', 'stand'],
  category: 'casino',
  description: `Blackjack contra la casa: .blackjack <monto>, luego .pedir o .plantarse. Blackjack paga 3 a 2. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const usada = (partes[0] || '').toLowerCase().replace(prefix, '');
    const arg = (partes[1] || '').toLowerCase();
    const accion = ['pedir', 'hit'].includes(usada) || ['pedir', 'hit'].includes(arg) ? 'pedir'
      : ['plantarse', 'stand', 'plantar'].includes(usada) || ['plantarse', 'stand', 'plantar'].includes(arg) ? 'plantar' : null;
    const responder = (t) => sock.sendMessage(jid, { text: t, mentions: [remitente] }, { quoted: msg });
    const aviso = (t) => responder(advertencia(t, { titulo: 'BLACKJACK', estilo: 'gamer' }));
    if (!ocupar(remitente)) return aviso('Espera a que termine tu jugada anterior. ⏳');
    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      let p = partidas.get(remitente);

      if (p && Date.now() - p.timestamp > EXPIRA_MS) { // se tardo: la casa juega por el
        return await resolver(sock, jid, msg, remitente, db, usuario, p, '⏰ Tardaste mucho y te plantaste automáticamente.');
      }

      if (accion) {
        if (!p) return aviso(`No tienes ninguna partida. Empieza con *${prefix}blackjack <monto>*`);
        p.timestamp = Date.now();
        if (accion === 'pedir') {
          p.jugador.push(p.mazo.pop());
          if (total(p.jugador) > 21 || total(p.jugador) === 21) return await resolver(sock, jid, msg, remitente, db, usuario, p, '');
          return responder(mesa(p, true, `Escribe *${prefix}pedir* otra carta o *${prefix}plantarse*`));
        }
        return await resolver(sock, jid, msg, remitente, db, usuario, p, '');
      }

      if (p) return responder(mesa(p, true, `Ya tienes una partida: *${prefix}pedir* o *${prefix}plantarse*`));
      const apuesta = parseInt(arg, 10);
      if (!apuesta || apuesta <= 0) return aviso(`Uso: ${prefix}blackjack <monto>\nLlega a 21 sin pasarte y supera a la casa.\n• ${prefix}pedir → otra carta\n• ${prefix}plantarse → te quedas\nBlackjack paga 3 a 2.\nEj: ${prefix}blackjack 100`);
      if (apuesta < MINIMO) return aviso(`La apuesta mínima es *$${MINIMO}*.`);
      if (usuario.saldo < apuesta) return responder(cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`, { titulo: 'BLACKJACK', estilo: 'gamer' }));

      usuario.saldo -= apuesta; // la apuesta queda en la mesa mientras juegas
      guardarDB(db);
      const mazo = mazoNuevo();
      p = { apuesta, mazo, jugador: [mazo.pop(), mazo.pop()], casa: [mazo.pop(), mazo.pop()], timestamp: Date.now() };
      partidas.set(remitente, p);
      if (esBJ(p.jugador)) return await resolver(sock, jid, msg, remitente, db, usuario, p, '');
      return responder(mesa(p, true, `Escribe *${prefix}pedir* otra carta o *${prefix}plantarse*`));
    } finally { liberar(remitente); }
  }
};

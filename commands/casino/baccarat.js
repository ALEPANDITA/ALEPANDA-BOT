const { marco, mezclar } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const PALOS = ['♠️', '♥️', '♦️', '♣️'];
const RANGOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const valor = (r) => (r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : parseInt(r, 10));
const total = (mano) => mano.reduce((s, c) => s + valor(c.r), 0) % 10;
const carta = (c) => `[${c.r}${c.p}]`;
const LADOS = { punto: 'punto', jugador: 'punto', banca: 'banca', banquero: 'banca', empate: 'empate', tie: 'empate' };
const NOMBRE = { punto: '🔵 PUNTO', banca: '🔴 BANCA', empate: '🟢 EMPATE' };

function mazo() {
  const m = [];
  for (let d = 0; d < 6; d++) for (const p of PALOS) for (const r of RANGOS) m.push({ r, p });
  return mezclar(m);
}

function jugarMano() {
  const m = mazo();
  const P = [m.pop(), m.pop()];
  const B = [m.pop(), m.pop()];
  const pasos = [{ P: [...P], B: [...B], pie: 'Se reparten las cartas...' }];
  const tp = total(P), tb = total(B);
  if (tp < 8 && tb < 8) {
    let terceraP = null;
    if (tp <= 5) { terceraP = m.pop(); P.push(terceraP); pasos.push({ P: [...P], B: [...B], pie: '🔵 Punto pide tercera carta' }); }
    const b = total(B);
    let pideB;
    if (!terceraP) pideB = b <= 5;
    else {
      const v = valor(terceraP.r);
      pideB = b <= 2 ? true : b === 3 ? v !== 8 : b === 4 ? v >= 2 && v <= 7 : b === 5 ? v >= 4 && v <= 7 : b === 6 ? v === 6 || v === 7 : false;
    }
    if (pideB) { B.push(m.pop()); pasos.push({ P: [...P], B: [...B], pie: '🔴 Banca pide tercera carta' }); }
  } else pasos.push({ P: [...P], B: [...B], pie: '🌟 ¡Natural! Nadie pide más' });
  const a = total(P), c = total(B);
  return { pasos, ganador: a > c ? 'punto' : c > a ? 'banca' : 'empate' };
}

function pantalla(paso, pie) {
  return marco('🃏 *BACCARAT* 🃏', [`🔵 Punto:  ${paso.P.map(carta).join(' ')}  = *${total(paso.P)}*`, `🔴 Banca:  ${paso.B.map(carta).join(' ')}  = *${total(paso.B)}*`, '', pie]);
}

module.exports = {
  name: 'baccarat',
  aliases: ['bacara', 'bacarat', 'baccara'],
  category: 'casino',
  description: `Baccarat: apuesta a punto (1:1), banca (0.95:1) o empate (8:1). Ej: .baccarat 100 banca. Minimo $${MINIMO}`,
  _jugarMano: jugarMano,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());
    const lado = partes.map((p) => LADOS[p]).find(Boolean);
    const apuesta = leerMonto(partes.find((p) => /^\d+$/.test(p) || /^(all|todo)$/.test(p)), 0);
    if (!lado || !apuesta) return aviso(sock, jid, msg, 'BACCARAT', `Uso: ${prefix}baccarat <monto> <punto/banca/empate>\n• 🔵 Punto paga 1:1\n• 🔴 Banca paga 0.95:1\n• 🟢 Empate paga 8:1 (si empata y apostaste punto/banca, te devuelvo tu apuesta)\nEj: ${prefix}baccarat 100 banca`);

    await correr(sock, jid, msg, {
      titulo: 'BACCARAT', apuesta, pausaMs: 1500,
      generar: () => {
        const { pasos, ganador } = jugarMano();
        const cab = `@${remitente.split('@')[0]} apostó *$${apuesta}* a ${NOMBRE[lado]}`;
        const cuadros = pasos.map((p, i) => ({ texto: pantalla({ P: i === 0 ? p.P.slice(0, 1) : p.P, B: i === 0 ? [] : p.B }, `${cab}\n${i === 0 ? 'Repartiendo...' : p.pie}`), ms: 1500 }));
        cuadros.unshift({ texto: marco('🃏 *BACCARAT* 🃏', [cab, '', '🂠 🂠 🂠 🂠', '', 'Barajando... 🌀']), ms: 1200 });
        const ult = pasos[pasos.length - 1];
        cuadros.push({ texto: pantalla(ult, `🏁 Gana ${NOMBRE[ganador]}`), ms: 1500 });
        let cambio;
        if (ganador === lado) cambio = lado === 'punto' ? apuesta : lado === 'banca' ? Math.floor(apuesta * 0.95) : apuesta * 8;
        else if (ganador === 'empate') cambio = 0;
        else cambio = -apuesta;
        const cierre = `🔵 ${total(ult.P)} vs 🔴 ${total(ult.B)}\n`;
        const detalle = cierre + (cambio > 0 ? `Ganó ${NOMBRE[ganador]}. ¡Ganaste *$${cambio}*!` : cambio === 0 ? 'Empate: te devuelvo tu apuesta.' : `Ganó ${NOMBRE[ganador]}. Perdiste *$${apuesta}*.`);
        return { cambio, cuadros, detalle };
      }
    });
  }
};

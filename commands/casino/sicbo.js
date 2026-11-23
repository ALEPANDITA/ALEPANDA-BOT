const { marco, aleatorio } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const CARA = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ALIAS = { alto: 'alto', alta: 'alto', high: 'alto', bajo: 'bajo', baja: 'bajo', low: 'bajo', triple: 'triple', trio: 'triple' };
const NOMBRE = { alto: '⬆️ ALTO (11-17)', bajo: '⬇️ BAJO (4-10)', triple: '🎯 TRIPLE' };

function pago(apuesta, dados) {
  const suma = dados[0] + dados[1] + dados[2];
  const triple = dados[0] === dados[1] && dados[1] === dados[2];
  if (apuesta === 'triple') return triple ? 30 : -1;
  if (apuesta === 'alto') return !triple && suma >= 11 ? 1 : -1;
  if (apuesta === 'bajo') return !triple && suma <= 10 ? 1 : -1;
  const n = parseInt(apuesta, 10);
  const veces = dados.filter((d) => d === n).length;
  return veces ? veces : -1;
}

const fila = (d) => d.map((x) => CARA[x]).join('  ');

module.exports = {
  name: 'sicbo',
  aliases: ['dados3', 'tresdados'],
  category: 'casino',
  description: `Sic Bo con 3 dados: alto/bajo 1:1, triple 30:1 o un número del 1 al 6 (paga por cada dado que coincida). Ej: .sicbo 100 alto. Minimo $${MINIMO}`,
  _pago: pago,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/).slice(1).map((p) => p.toLowerCase());
    const apuesta = leerMonto(partes[0], 0);
    const eleccion = ALIAS[partes[1]] || (/^[1-6]$/.test(partes[1] || '') ? partes[1] : null);
    if (!apuesta || !eleccion) return aviso(sock, jid, msg, 'SIC BO', `Uso: ${prefix}sicbo <monto> <alto/bajo/triple/1-6>\n• ⬆️ alto (11-17) y ⬇️ bajo (4-10) pagan 1:1 (pierden si sale triple)\n• 🎯 triple (3 dados iguales) paga 30:1\n• Un número 1-6 paga 1:1 por cada dado que lo muestre\nEj: ${prefix}sicbo 100 alto`);

    await correr(sock, jid, msg, {
      titulo: 'SIC BO', apuesta, pausaMs: 700,
      generar: () => {
        const dados = [1, 2, 3].map(() => 1 + aleatorio(6));
        const etiqueta = /^[1-6]$/.test(eleccion) ? `el número *${eleccion}*` : NOMBRE[eleccion];
        const cab = `@${remitente.split('@')[0]} apostó *$${apuesta}* a ${etiqueta}`;
        const titulo = '🎲 *SIC BO* 🎲';
        const cuadros = [];
        for (let i = 0; i < 6; i++) {
          const temp = [1, 2, 3].map(() => 1 + aleatorio(6));
          cuadros.push({ texto: marco(titulo, [cab, '', fila(temp), '', `Agitando${'.'.repeat(1 + (i % 3))} 🌀`]), ms: 500 + i * 120 });
        }
        cuadros.push({ texto: marco(titulo, [cab, '', fila(dados), '', 'Suma: *' + (dados[0] + dados[1] + dados[2]) + '*']), ms: 1100 });
        const m = pago(eleccion, dados);
        const cambio = m > 0 ? apuesta * m : -apuesta;
        const suma = dados[0] + dados[1] + dados[2];
        const triple = dados[0] === dados[1] && dados[1] === dados[2];
        const info = `${fila(dados)}  = *${suma}*${triple ? ' (¡TRIPLE!)' : ''}`;
        const detalle = info + '\n' + (cambio > 0 ? `¡Ganaste *$${cambio}*! (x${m})` : `Perdiste *$${apuesta}*.`);
        return { cambio, cuadros, detalle };
      }
    });
  }
};

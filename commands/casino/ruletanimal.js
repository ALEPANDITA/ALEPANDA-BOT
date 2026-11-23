const { marco, aleatorio } = require('../../lib/cuadros');
const { correr, leerMonto, aviso, MINIMO } = require('../../lib/casinoextra');

const ANIMALES = [
  { id: 'panda', emoji: '🐼', alias: ['oso'] }, { id: 'zorro', emoji: '🦊', alias: [] },
  { id: 'tigre', emoji: '🐯', alias: [] }, { id: 'rana', emoji: '🐸', alias: [] },
  { id: 'pulpo', emoji: '🐙', alias: [] }, { id: 'unicornio', emoji: '🦄', alias: ['unicorn'] },
  { id: 'tortuga', emoji: '🐢', alias: [] }, { id: 'buho', emoji: '🦉', alias: ['búho'] }
];
const PAGO = 7.5;

function buscar(palabra) {
  const p = String(palabra || '').toLowerCase();
  return ANIMALES.find((a) => a.id === p || a.alias.includes(p) || a.emoji === palabra) || null;
}

function pantalla(pos, elegido, pie) {
  const fila = ANIMALES.map((a, i) => (i === pos ? `【${a.emoji}】` : a.emoji)).join(' ');
  return marco('🎪 *RULETA DE ANIMALES* 🎪', [`Tu animal: ${elegido.emoji} *${elegido.id}*`, '', fila, '', pie]);
}

module.exports = {
  name: 'ruletanimal',
  aliases: ['ruletaanimal', 'zoo', 'animales'],
  category: 'casino',
  description: `Ruleta de animales: eliges uno de 8 y si la ruleta cae en el tuyo cobras x${PAGO}. Ej: .ruletanimal 100 panda. Minimo $${MINIMO}`,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const partes = texto.trim().split(/\s+/).slice(1);
    const apuesta = leerMonto(partes.find((p) => /^\d+$/.test(p) || /^(all|todo)$/i.test(p)), 0);
    const elegido = partes.map(buscar).find(Boolean) || null;
    if (!apuesta || !elegido) {
      return aviso(sock, jid, msg, 'RULETA ANIMAL', `Uso: ${prefix}ruletanimal <monto> <animal>\n• Animales: ${ANIMALES.map((a) => `${a.emoji} ${a.id}`).join(' · ')}\n• Si cae en el tuyo cobras x${PAGO}\nEj: ${prefix}ruletanimal 100 panda`);
    }
    await correr(sock, jid, msg, {
      titulo: 'RULETA ANIMAL', apuesta,
      generar: () => {
        const final = aleatorio(ANIMALES.length);
        const n = ANIMALES.length;
        const pasos = 3 * n + 4;
        const cuadros = [];
        for (let k = 0; k <= pasos; k++) {
          const pos = (((final - pasos + k) % n) + n) % n;
          const ms = k < 14 ? 300 : k < 22 ? 480 : k < pasos - 3 ? 750 : k === pasos - 3 ? 1000 : k === pasos - 2 ? 1300 : 1600;
          const pie = k < pasos - 3 ? `Girando${'.'.repeat(1 + (k % 3))} 🌀` : k < pasos ? '¡Ya casi! 😰' : '¡Se detuvo! 🎯';
          cuadros.push({ texto: pantalla(pos, elegido, `@${(msg.key.participant || msg.key.remoteJid).split('@')[0]} apostó *$${apuesta}*\n${pie}`), ms });
        }
        const sale = ANIMALES[final];
        const gano = sale.id === elegido.id;
        const premio = Math.floor(apuesta * PAGO);
        return {
          cambio: gano ? premio - apuesta : -apuesta,
          cuadros,
          detalle: gano ? `${sale.emoji} ¡Salió *${sale.id}*! ¡Era el tuyo!\nGanaste *$${premio - apuesta}*.` : `${sale.emoji} Salió *${sale.id}*... tú elegiste ${elegido.emoji}.\nPerdiste *$${apuesta}*.`
        };
      }
    });
  }
};

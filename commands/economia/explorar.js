const eco = require('../../lib/eco-anim');

const COOLDOWN = 30 * 60 * 1000;
const SALAS = 3;

// Cada evento devuelve { texto, monto } (monto negativo = pierdes dinero)
const EVENTOS = [
  { peso: 20, crear: () => ({ texto: '🧰 ¡Un cofre antiguo!', monto: eco.aleatorio(60, 200) }) },
  { peso: 30, crear: () => ({ texto: '💎 Monedas entre el polvo', monto: eco.aleatorio(20, 70) }) },
  { peso: 15, crear: () => ({ texto: '🪤 ¡Una trampa de pinchos!', monto: -eco.aleatorio(20, 80) }) },
  {
    peso: 15,
    crear: () => (Math.random() < 0.5
      ? { texto: '👹 Derrotaste a un guardián', monto: eco.aleatorio(80, 160) }
      : { texto: '👹 Un guardián te hizo huir', monto: -eco.aleatorio(40, 100) })
  },
  { peso: 20, crear: () => ({ texto: '🕸️ Una sala vacía', monto: 0 }) }
];

function sortearEvento() {
  const total = EVENTOS.reduce((s, e) => s + e.peso, 0);
  let r = Math.random() * total;
  for (const e of EVENTOS) {
    r -= e.peso;
    if (r < 0) return e.crear();
  }
  return EVENTOS[EVENTOS.length - 1].crear();
}

const conSigno = (n) => (n > 0 ? `+${eco.dinero(n)}` : n < 0 ? `-${eco.dinero(-n)}` : '$0');

module.exports = {
  name: 'explorar',
  aliases: ['explora', 'ruinas'],
  category: 'economia',
  description: 'Explora unas ruinas con tesoros y trampas (cada 30 min). Animado',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const falta = eco.restante(usuario, 'lastExplorar', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'explorar otra vez') }, { quoted: msg });

    await eco.correr(sock, jid, msg, `explorar:${llave}`, async () => {
      const salas = Array.from({ length: SALAS }, sortearEvento);
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'EXPLORAR' });
      const cuadro = (hechas, entrando) => {
        const lineas = ['🗺️ Ruinas olvidadas', eco.barra(hechas / SALAS), ''];
        for (let i = 0; i < hechas; i++) lineas.push(`🚪 Sala ${i + 1}: ${salas[i].texto} (${conSigno(salas[i].monto)})`);
        if (entrando) lineas.push(`🚪 Sala ${hechas + 1}: entrando... 🔦`);
        return lineas;
      };

      await anim.paso(['🗺️ Ruinas olvidadas', eco.barra(0), '', '🎒 Preparas la mochila y la linterna...']);
      for (let i = 0; i < SALAS; i++) {
        await anim.paso(cuadro(i, true));
        await anim.paso(cuadro(i + 1, false));
      }

      const neto = salas.reduce((s, e) => s + e.monto, 0);
      const { antes, despues } = eco.actualizar(remitente, (u) => {
        const antesSaldo = Number(u.saldo) || 0;
        u.saldo = Math.max(0, antesSaldo + neto); // nunca queda en negativo
        u.lastExplorar = Date.now();
        return { antes: antesSaldo, despues: u.saldo };
      });
      const real = despues - antes;

      const lineas = cuadro(SALAS, false);
      lineas[0] = '✅ Saliste de las ruinas';
      lineas.push('', real >= 0 ? `💰 Ganaste: *${eco.dinero(real)}*` : `💸 Perdiste: *${eco.dinero(-real)}*`, `💼 Saldo actual: *${eco.dinero(despues)}*`);
      await anim.final(lineas);
    });
  }
};

const eco = require('../../lib/eco-anim');

const COOLDOWN = 15 * 60 * 1000;
const ARBOLES = 5;
const PRECIO_TRONCO = 7;
const BONO_RAMA_DORADA = 100;

module.exports = {
  name: 'talar',
  aliases: ['tala'],
  category: 'economia',
  description: 'Tala árboles y vende la madera (cada 15 min). Animado',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const falta = eco.restante(usuario, 'lastTalar', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'talar otra vez') }, { quoted: msg });

    await eco.correr(sock, jid, msg, `talar:${llave}`, async () => {
      // El resultado se decide antes de animar
      const arboles = Array.from({ length: ARBOLES }, () => ({ troncos: eco.aleatorio(1, 2), dorada: Math.random() < 0.05 }));
      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'TALAR' });

      await anim.paso(['🪓 Te internas en el bosque...', '🌲🌲🌲🌲🌲', eco.barra(0)]);

      let troncos = 0;
      let doradas = 0;
      for (let i = 0; i < ARBOLES; i++) {
        troncos += arboles[i].troncos;
        if (arboles[i].dorada) doradas++;
        const fila = Array.from({ length: ARBOLES }, (_, k) => (k <= i ? '🪵' : '🌲')).join('');
        const lineas = [`🪓 ¡Árbol ${i + 1}/${ARBOLES} derribado!`, fila, eco.barra((i + 1) / ARBOLES), `🪵 Troncos: ${troncos}`];
        if (doradas) lineas.push(`✨ ¡Rama dorada! x${doradas}`);
        await anim.paso(lineas);
      }

      const ventaTroncos = troncos * PRECIO_TRONCO;
      const bono = doradas * BONO_RAMA_DORADA;
      const total = ventaTroncos + bono;

      // Recién ahora se lee la base y se paga
      const saldo = eco.actualizar(remitente, (u) => {
        u.saldo = (Number(u.saldo) || 0) + total;
        u.lastTalar = Date.now();
        return u.saldo;
      });

      const lineas = ['✅ Terminaste de talar', '', `🪵 ${troncos} troncos x ${eco.dinero(PRECIO_TRONCO)} = ${eco.dinero(ventaTroncos)}`];
      if (doradas) lineas.push(`✨ ${doradas} rama(s) dorada(s): +${eco.dinero(bono)}`);
      lineas.push(`💰 Ganaste: *${eco.dinero(total)}*`, `💼 Saldo actual: *${eco.dinero(saldo)}*`);
      await anim.final(lineas);
    });
  }
};

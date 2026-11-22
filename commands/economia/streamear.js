const eco = require('../../lib/eco-anim');

const COOLDOWN = 45 * 60 * 1000;
const FASES = 4;
const MAX_ESPECTADORES = 300;
const CHAT = [
  'primero! 🥇', 'jajaja eso estuvo bueno', 'saluden a mi mamá', 'F', 'qué crack 🔥', 'dale like y suscríbete',
  'pásame el link del bot', '🔥🔥🔥', 'no manches 😂', 'más fuerte que no se oye'
];

module.exports = {
  name: 'streamear',
  aliases: ['stream', 'directo'],
  category: 'economia',
  description: 'Haz un directo y gana por espectadores y donaciones (cada 45 min). Animado',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const falta = eco.restante(usuario, 'lastStream', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'hacer otro directo') }, { quoted: msg });

    await eco.correr(sock, jid, msg, `streamear:${llave}`, async () => {
      const raid = Math.random() < 0.08;
      const espectadores = eco.aleatorio(20, 150) * (raid ? 2 : 1);
      const pagoPorVista = eco.aleatorio(8, 20) / 10;
      const donacion = Math.random() < 0.6 ? eco.aleatorio(10, 120) : 0;
      const ganancia = Math.floor(espectadores * pagoPorVista) + donacion;

      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'DIRECTO' });
      await anim.paso(['📡 Conectando la cámara...', eco.barra(0)]);
      await anim.paso(['🔴 ¡EN VIVO!', '👀 Espectadores: 0', eco.barra(0)]);

      for (let i = 1; i <= FASES; i++) {
        const progreso = i / FASES;
        const vistas = Math.max(1, Math.round(espectadores * progreso * (i === FASES ? 1 : 0.85 + Math.random() * 0.3)));
        const lineas = ['🔴 ¡EN VIVO!', `👀 Espectadores: ${vistas}`, eco.barra(vistas / MAX_ESPECTADORES), `💬 "${eco.elegir(CHAT)}"`];
        if (raid && i === 3) lineas.push('🚀 ¡Te hicieron RAID! Llegó mucha gente');
        if (donacion && i === FASES) lineas.push(`🎁 Un espectador donó ${eco.dinero(donacion)}`);
        await anim.paso(lineas);
      }

      const saldo = eco.actualizar(remitente, (u) => {
        u.saldo = (Number(u.saldo) || 0) + ganancia;
        u.lastStream = Date.now();
        return u.saldo;
      });

      const lineas = ['⚫ Directo terminado', '', `👀 Espectadores: ${espectadores}${raid ? ' (con raid 🚀)' : ''}`];
      if (donacion) lineas.push(`🎁 Donaciones: ${eco.dinero(donacion)}`);
      lineas.push(`💰 Ganaste: *${eco.dinero(ganancia)}*`, `💼 Saldo actual: *${eco.dinero(saldo)}*`);
      await anim.final(lineas);
    });
  }
};

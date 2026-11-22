const eco = require('../../lib/eco-anim');

const COOLDOWN = 12 * 60 * 1000;
const LARGO = 10; // casillas del camino
const PASAJEROS = ['un turista con maletas', 'una señora con bolsas', 'un influencer apurado', 'un estudiante dormido', 'un señor que habla de futbol'];
const TRAMOS = [
  { pos: 0, texto: 'Recoges a {p}' },
  { pos: 3, texto: 'En camino por el centro' },
  { pos: 5, texto: 'Atrapado en el tráfico... 🚦' },
  { pos: 8, texto: 'Ya casi llegas' },
  { pos: LARGO, texto: 'Llegaste a destino' }
];

const camino = (pos) => `🏁 ${'─'.repeat(pos)}🚕${'─'.repeat(LARGO - pos)} 🏠`;

module.exports = {
  name: 'taxi',
  aliases: ['uber'],
  category: 'economia',
  description: 'Maneja un taxi y cobra por viaje (cada 12 min). Animado',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { usuario, llave } = eco.ficha(remitente);
    const falta = eco.restante(usuario, 'lastTaxi', COOLDOWN);
    if (falta > 0) return sock.sendMessage(jid, { text: eco.textoEspera(falta, 'tomar otro viaje') }, { quoted: msg });

    await eco.correr(sock, jid, msg, `taxi:${llave}`, async () => {
      const pasajero = eco.elegir(PASAJEROS);
      const r = Math.random();
      let tipo = 'normal';
      let cambio = 0;
      let propina = 0;
      if (r < 0.08) tipo = 'sinpagar';
      else if (r < 0.13) { tipo = 'multa'; cambio = -eco.aleatorio(15, 40); }
      else { cambio = eco.aleatorio(20, 55); propina = Math.random() < 0.5 ? eco.aleatorio(5, 30) : 0; cambio += propina; }

      const anim = eco.crearAnimacion(sock, jid, msg, { titulo: 'TAXI' });
      for (const tramo of TRAMOS) {
        await anim.paso([`🚖 Viaje con ${pasajero}`, camino(tramo.pos), '', tramo.texto.replace('{p}', pasajero)]);
      }

      const { antes, despues } = eco.actualizar(remitente, (u) => {
        const a = Number(u.saldo) || 0;
        u.saldo = Math.max(0, a + cambio);
        u.lastTaxi = Date.now();
        return { antes: a, despues: u.saldo };
      });
      const real = despues - antes;

      const lineas = [`🚖 Viaje con ${pasajero}`, camino(LARGO), ''];
      if (tipo === 'sinpagar') lineas.push('😡 ¡Se bajó corriendo y no pagó!', '💰 Ganaste: *$0*');
      else if (tipo === 'multa') lineas.push('🚓 Te paró un policía y te multó', `💸 Multa: *${eco.dinero(-real)}*`);
      else lineas.push(`💰 Tarifa: ${eco.dinero(cambio - propina)}`, propina ? `🎁 Propina: ${eco.dinero(propina)}` : '🙁 Sin propina', `✅ Ganaste: *${eco.dinero(real)}*`);
      lineas.push(`💼 Saldo actual: *${eco.dinero(despues)}*`);
      await anim.final(lineas);
    });
  }
};

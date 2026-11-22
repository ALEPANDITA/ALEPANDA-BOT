const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { reproducir, marco, sorteo, aleatorio, ocupar, liberar } = require('../../lib/cuadros');

const COOLDOWN = 25 * 60 * 1000;
const PECES = [
  { peso: 10, nombre: 'una bota vieja 👢', min: 0, max: 0 },
  { peso: 35, nombre: 'un pez pequeño 🐟', min: 30, max: 70 },
  { peso: 28, nombre: 'una trucha 🐠', min: 70, max: 140 },
  { peso: 17, nombre: 'un atún 🐟', min: 140, max: 260 },
  { peso: 8, nombre: 'un pez espada 🗡️', min: 280, max: 450 },
  { peso: 2, nombre: 'un cofre del fondo del mar 🧰', min: 500, max: 800 }
];

module.exports = {
  name: 'pescar',
  aliases: ['pesca', 'fish'],
  category: 'economia',
  description: 'Lanza la caña y vende lo que pesques (cada 25 min)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    if (!ocupar(remitente)) return sock.sendMessage(jid, { text: 'Espera a que termine tu pesca anterior. ⏳' }, { quoted: msg });
    try {
      const db = leerDB();
      const usuario = getUsuario(db, remitente);
      const restante = (usuario.lastPescar || 0) + COOLDOWN - Date.now();
      if (restante > 0) return sock.sendMessage(jid, { text: `⏳ Espera ${Math.ceil(restante / 60000)} minuto(s) para volver a pescar.` }, { quoted: msg });

      const pez = sorteo(PECES);
      const ganancia = pez.max > 0 ? pez.min + aleatorio(pez.max - pez.min + 1) : 0;
      usuario.lastPescar = Date.now();
      usuario.saldo += ganancia;
      guardarDB(db);

      const t = '🎣 *PESCAR* 🎣';
      const olas = (n) => '🌊'.repeat(3 + n);
      const final = ganancia > 0
        ? `🎣 ¡Pescaste *${pez.nombre}* y lo vendiste por *$${ganancia}*!\n💳 Saldo actual: *$${usuario.saldo}*`
        : `🎣 Pescaste *${pez.nombre}*... no vale nada. 😅\n💳 Saldo actual: *$${usuario.saldo}*`;
      await reproducir(sock, jid, [
        marco(t, ['Lanzas la caña...', '', olas(0)]),
        marco(t, ['Esperando que piquen...', '', olas(1)]),
        marco(t, ['¡Algo mordió el anzuelo! 😮', '', olas(2)]),
        { texto: final }], { quoted: msg, pausaMs: 1200 });
    } finally { liberar(remitente); }
  }
};

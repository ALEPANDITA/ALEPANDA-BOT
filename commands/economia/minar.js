const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COOLDOWN = 20 * 60 * 1000;
const minerales = [
  { nombre: 'carbon', valorMin: 20, valorMax: 60, prob: 0.40 },
  { nombre: 'hierro', valorMin: 40, valorMax: 100, prob: 0.30 },
  { nombre: 'oro', valorMin: 80, valorMax: 180, prob: 0.20 },
  { nombre: 'diamante', valorMin: 200, valorMax: 400, prob: 0.08 },
  { nombre: 'nada, la mina estaba vacia', valorMin: 0, valorMax: 0, prob: 0.02 }
];

function elegirMineral() {
  const r = Math.random();
  let acumulado = 0;
  for (const m of minerales) {
    acumulado += m.prob;
    if (r <= acumulado) return m;
  }
  return minerales[0];
}

module.exports = {
  name: 'minar',
  category: 'economia',
  description: 'Excava en busca de minerales para vender (cada 20 min)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastMinar + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, { text: `⏳ Espera ${minutos} minuto(s) para volver a minar.` });
    }

    usuario.lastMinar = ahora;
    const mineral = elegirMineral();
    const ganancia = mineral.valorMax > 0
      ? Math.floor(Math.random() * (mineral.valorMax - mineral.valorMin + 1)) + mineral.valorMin
      : 0;

    usuario.saldo += ganancia;
    guardarDB(db);

    const texto = ganancia > 0
      ? `⛏️ Encontraste *${mineral.nombre}* y lo vendiste por *$${ganancia}*.\nSaldo actual: *$${usuario.saldo}*`
      : `⛏️ Excavaste pero no encontraste ${mineral.nombre}.`;

    await sock.sendMessage(jid, { text: texto });
  }
};

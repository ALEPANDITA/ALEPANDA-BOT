const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COOLDOWN = 60 * 60 * 1000;
const trabajos = [
  'repartiste pizzas', 'programaste una app', 'lavaste autos',
  'diste clases particulares', 'vendiste tacos', 'paseaste perros'
];

module.exports = {
  name: 'trabajar',
  category: 'economia',
  description: 'Trabajar para ganar dinero (cada 1 hora)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastTrabajo + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, { text: `⏳ Ya trabajaste. Espera ${minutos} minuto(s) para volver a trabajar.` });
    }

    const ganancia = Math.floor(Math.random() * 200) + 50;
    const trabajo = trabajos[Math.floor(Math.random() * trabajos.length)];

    usuario.saldo += ganancia;
    usuario.lastTrabajo = ahora;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `💼 Hoy ${trabajo} y ganaste *$${ganancia}*.\nSaldo actual: *$${usuario.saldo}*` });
  }
};

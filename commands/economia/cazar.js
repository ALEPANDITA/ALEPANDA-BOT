const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COOLDOWN = 30 * 60 * 1000;
const animales = ['conejo', 'venado', 'jabali', 'zorro', 'pato'];

module.exports = {
  name: 'cazar',
  category: 'economia',
  description: 'Sal de caceria por dinero (arriesgas vida, cada 30 min)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastCazar + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, { text: `⏳ Espera ${minutos} minuto(s) para volver a cazar.` });
    }

    if (usuario.vida <= 10) {
      return sock.sendMessage(jid, { text: '❤️ Tienes muy poca vida. Usa .curar antes de volver a cazar.' });
    }

    usuario.lastCazar = ahora;
    const animal = animales[Math.floor(Math.random() * animales.length)];
    const exito = Math.random() < 0.7;

    if (exito) {
      const ganancia = Math.floor(Math.random() * 150) + 50;
      usuario.saldo += ganancia;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `🏹 Cazaste un *${animal}* y lo vendiste por *$${ganancia}*.\nSaldo actual: *$${usuario.saldo}*` });
    }

    const dano = Math.floor(Math.random() * 20) + 5;
    usuario.vida = Math.max(0, usuario.vida - dano);
    guardarDB(db);
    await sock.sendMessage(jid, { text: `🩹 El ${animal} te ataco antes de escapar. Perdiste *${dano}* de vida.\nVida actual: *${usuario.vida}/100*` });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COSTO_POR_VIDA = 5;

module.exports = {
  name: 'curar',
  category: 'economia',
  description: 'Recupera vida perdida cazando (cuesta $5 por punto de vida)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.vida >= 100) {
      return sock.sendMessage(jid, { text: '❤️ Ya tienes tu vida al maximo (100/100).' });
    }

    const faltante = 100 - usuario.vida;
    const costoTotal = faltante * COSTO_POR_VIDA;

    if (usuario.saldo < costoTotal) {
      const vidaAlcanzable = Math.floor(usuario.saldo / COSTO_POR_VIDA);
      if (vidaAlcanzable <= 0) {
        return sock.sendMessage(jid, { text: `No tienes suficiente dinero. Necesitas al menos $${COSTO_POR_VIDA} para curar 1 punto de vida.` });
      }
      usuario.saldo -= vidaAlcanzable * COSTO_POR_VIDA;
      usuario.vida += vidaAlcanzable;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `🩹 Te curaste ${vidaAlcanzable} punto(s) de vida (todo lo que tu dinero alcanzo).\nVida actual: *${usuario.vida}/100*\nSaldo actual: *$${usuario.saldo}*` });
    }

    usuario.saldo -= costoTotal;
    usuario.vida = 100;
    guardarDB(db);
    await sock.sendMessage(jid, { text: `🩹 Te curaste por completo.\nVida actual: *100/100*\nSaldo actual: *$${usuario.saldo}*\nCosto: *$${costoTotal}*` });
  }
};

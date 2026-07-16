const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'depositar',
  category: 'casino',
  description: 'Deposita diamantes en el banco (ej: .depositar 100 o .depositar all)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const who = msg.key.participant || msg.key.remoteJid;
    const valor = texto.slice((prefix + 'depositar ').length).trim().toLowerCase();

    const db = leerDB();
    const usuario = getUsuario(db, who);

    const monto = valor === 'all' ? usuario.saldo : parseInt(valor);

    if (!monto || monto <= 0 || monto > usuario.saldo) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}depositar <cantidad> | ${prefix}depositar all\nTu cartera: ${usuario.saldo || 0} 💎` });
    }

    usuario.saldo -= monto;
    usuario.banco = (usuario.banco || 0) + monto;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `🏦 Depositaste ${monto} 💎.\nCartera: ${usuario.saldo} 💎 | Banco: ${usuario.banco} 💎` });
  }
};

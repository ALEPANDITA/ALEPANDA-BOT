const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'retirar',
  category: 'casino',
  description: 'Retira diamantes del banco (ej: .retirar 100 o .retirar all)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const who = msg.key.participant || msg.key.remoteJid;
    const valor = texto.slice((prefix + 'retirar ').length).trim().toLowerCase();

    const db = leerDB();
    const usuario = getUsuario(db, who);

    const monto = valor === 'all' ? usuario.banco : parseInt(valor);

    if (!monto || monto <= 0 || monto > usuario.banco) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}retirar <cantidad> | ${prefix}retirar all\nTu banco: ${usuario.banco || 0} 💎` });
    }

    usuario.banco -= monto;
    usuario.saldo = (usuario.saldo || 0) + monto;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `👛 Retiraste ${monto} 💎.\nCartera: ${usuario.saldo} 💎 | Banco: ${usuario.banco} 💎` });
  }
};

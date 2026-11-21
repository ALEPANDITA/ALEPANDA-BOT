const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { llaveRemitente, llavePersona, objetivoDe } = require('../../lib/economiaid');

module.exports = {
  name: 'transferir',
  category: 'economia',
  description: 'Enviar dinero a otro usuario (responde o menciona + monto)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const objetivo = objetivoDe(msg);

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona o responde a alguien: ${prefix}transferir <monto>` });
    }

    const partes = texto.trim().split(/\s+/);
    const monto = parseInt(partes[partes.length - 1]);

    if (!monto || monto <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}transferir <monto> (mencionando o respondiendo a alguien)` });
    }

    const db = leerDB();
    const llaveYo = await llaveRemitente(sock, jid, db, msg);
    const llaveReceptor = await llavePersona(sock, jid, db, objetivo);

    if (llaveYo === llaveReceptor) {
      return sock.sendMessage(jid, { text: 'No puedes transferirte dinero a ti mismo.' });
    }

    const usuario = getUsuario(db, llaveYo);
    const receptor = getUsuario(db, llaveReceptor);

    if (usuario.saldo < monto) {
      guardarDB(db);
      return sock.sendMessage(jid, { text: `No tienes suficiente saldo. Tu saldo: $${usuario.saldo}` });
    }

    usuario.saldo -= monto;
    receptor.saldo += monto;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `✅ Transferiste *$${monto}*.\nTu saldo actual: *$${usuario.saldo}*` });
  }
};

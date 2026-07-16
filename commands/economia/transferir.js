const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'transferir',
  category: 'economia',
  description: 'Enviar dinero a otro usuario (responde o menciona + monto)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona o responde a alguien: ${prefix}transferir <monto>` });
    }

    const partes = texto.trim().split(/\s+/);
    const monto = parseInt(partes[partes.length - 1]);

    if (!monto || monto <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}transferir <monto> (mencionando o respondiendo a alguien)` });
    }

    if (objetivo === remitente) {
      return sock.sendMessage(jid, { text: 'No puedes transferirte dinero a ti mismo.' });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const receptor = getUsuario(db, objetivo);

    if (usuario.saldo < monto) {
      return sock.sendMessage(jid, { text: `No tienes suficiente saldo. Tu saldo: $${usuario.saldo}` });
    }

    usuario.saldo -= monto;
    receptor.saldo += monto;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `✅ Transferiste *$${monto}*.\nTu saldo actual: *$${usuario.saldo}*` });
  }
};

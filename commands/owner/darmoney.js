const { leerConfig } = require('../../lib/config');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'darmoney',
  category: 'owner',
  description: 'Dar dinero a un usuario (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.owners || !config.owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    console.log('DEBUG remitente:', remitente);
    console.log('DEBUG mentionedJid:', msg.message.extendedTextMessage?.contextInfo?.mentionedJid);
    console.log('DEBUG participant citado:', msg.message.extendedTextMessage?.contextInfo?.participant);

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    console.log('DEBUG objetivo final:', objetivo);

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona o responde a alguien: ${prefix}darmoney <monto>` });
    }

    const partes = texto.trim().split(/\s+/);
    const monto = parseInt(partes[partes.length - 1]);

    if (!monto || monto <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}darmoney <monto> (mencionando o respondiendo a alguien)` });
    }

    const db = leerDB();
    const receptor = getUsuario(db, objetivo);
    receptor.saldo += monto;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `✅ Le diste *$${monto}* al usuario.\nSu saldo actual: *$${receptor.saldo}*` });
  }
};

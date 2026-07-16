const { leerDB, guardarDB, getGrupo } = require('../../lib/db');

module.exports = {
  name: 'setprefix',
  category: 'admin',
  description: 'Cambia el prefijo de este grupo (ej: .setprefix !)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const metadata = await sock.groupMetadata(jid);
    const remitente = msg.key.participant;
    const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin del grupo puede cambiar el prefijo.' });
    }

    const nuevoPrefix = texto.slice((prefix + 'setprefix ').length).trim();

    if (!nuevoPrefix) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}setprefix <nuevo prefijo>\nEjemplo: ${prefix}setprefix !` });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    grupo.prefix = nuevoPrefix;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `Prefijo de este grupo cambiado a: ${nuevoPrefix}` });
  }
};

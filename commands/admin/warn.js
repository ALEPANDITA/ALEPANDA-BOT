const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'warn',
  category: 'admin',
  description: 'Advertir usuario',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede dar advertencias.' });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con !warn' });
    }

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);
    usuario.warns += 1;
    guardarDB(db);

    await sock.sendMessage(jid, { text: `Usuario advertido. Total de advertencias: ${usuario.warns}` });
  }
};

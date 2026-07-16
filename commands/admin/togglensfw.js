module.exports = {
  name: 'togglensfw',
  aliases: ['tnsfw'],
  category: 'admin',
  description: 'Activa/desactiva comandos NSFW en el grupo',
  groupOnly: true,
  execute: async (sock, jid, msg, { prefix }) => {
    const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
    const { esAdminDelGrupo } = require('../../lib/permisos');
    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const remitente = msg.key.participant;

    const esAdmin = await esAdminDelGrupo(sock, jid, remitente);
    if (!esAdmin) return await sock.sendMessage(jid, { text: '❌ Solo los *admins* pueden usar este comando.' });

    grupo.nsfw = !grupo.nsfw;
    guardarDB(db);
    await sock.sendMessage(jid, { text: `✅ Comandos *NSFW* ahora están *${grupo.nsfw ? '✅ ACTIVADOS' : '❌ DESACTIVADOS'}* en este grupo.` });
  }
};

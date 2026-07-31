module.exports = {
  name: 'enable',
  aliases: ['e'],
  category: 'admin',
  description: 'Activa/desactiva funciones en el grupo',
  groupOnly: true,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
    const { esAdminDelGrupo } = require('../../lib/permisos');
    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const remitente = msg.key.participant;
    const args = texto.slice(prefix.length).trim().split(/ \s+/);
    const opcion = args[1]?.toLowerCase();

    const esAdmin = await esAdminDelGrupo(sock, jid, remitente);
    if (!esAdmin) return await sock.sendMessage(jid, { text: '❌ Solo los *admins* pueden usar este comando.' });

    if (opcion === 'nsfw') {
      grupo.nsfw = !grupo.nsfw;
      guardarDB(db);
      return await sock.sendMessage(jid, { text: `✅ Comandos *NSFW* ahora están *${grupo.nsfw ? '✅ ACTIVADOS' : '❌ DESACTIVADOS'}* en este grupo.` });
    }

    // Aquí va el código original de tu comando `enable` (si lo tenía)
    await sock.sendMessage(jid, { text: `❌ Opción no reconocida. Usa: *${prefix}enable nsfw*` });
  }
};

const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');
const { cancelarApertura } = require('../../lib/cierre-grupos');

module.exports = {
  name: 'abrir',
  category: 'admin',
  description: 'Abrir grupo (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esAdminBot = await esAdminDelBot(sock, jid);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: 'Necesito ser admin para hacer esto.' });
    }

    await sock.groupSettingUpdate(jid, 'not_announcement');
    // Si estaba cerrado con tiempo (.cerrar 30m), ya no hay que abrirlo solo
    const habia = cancelarApertura(jid);
    await sock.sendMessage(jid, { text: `Grupo abierto. Todos pueden escribir.${habia ? '\n(Se cancelo la apertura automatica programada.)' : ''}` });
  }
};

const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

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
    await sock.sendMessage(jid, { text: 'Grupo abierto. Todos pueden escribir.' });
  }
};

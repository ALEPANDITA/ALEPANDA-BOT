const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

module.exports = {
  name: 'revoke',
  aliases: ['resetlink', 'resetearlink'],
  category: 'admin',
  description: 'Restablece el link de invitacion del grupo: el anterior deja de funcionar (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esAdminBot = await esAdminDelBot(sock, jid);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' }, { quoted: msg });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: 'Necesito ser admin para restablecer el link.' }, { quoted: msg });
    }

    try {
      await sock.groupRevokeInvite(jid);
      await sock.sendMessage(jid, { text: '✅ Listo, el link anterior ya no sirve. Usa .link para ver el nuevo.' }, { quoted: msg });
    } catch (err) {
      console.error('[revoke]', err.message);
      await sock.sendMessage(jid, { text: 'No pude restablecer el link del grupo.' }, { quoted: msg });
    }
  }
};

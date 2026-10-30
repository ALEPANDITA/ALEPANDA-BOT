const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

module.exports = {
  name: 'link',
  aliases: ['enlace'],
  category: 'admin',
  description: 'Muestra el link de invitacion del grupo (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin, metadata } = await esAdminDelGrupo(sock, jid, remitente);
    const esAdminBot = await esAdminDelBot(sock, jid);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' }, { quoted: msg });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: 'Necesito ser admin para sacar el link del grupo.' }, { quoted: msg });
    }

    try {
      const codigo = await sock.groupInviteCode(jid);
      if (!codigo) throw new Error('sin codigo');
      await sock.sendMessage(jid, {
        text: `🔗 *${metadata.subject || 'Grupo'}*\nhttps://chat.whatsapp.com/${codigo}`
      }, { quoted: msg });
    } catch (err) {
      console.error('[link]', err.message);
      await sock.sendMessage(jid, { text: 'No pude obtener el link del grupo.' }, { quoted: msg });
    }
  }
};

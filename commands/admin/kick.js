const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

module.exports = {
  name: 'kick',
  category: 'admin',
  description: 'Expulsar (mencion o responde)',
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

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con .kick' });
    }

    await sock.groupParticipantsUpdate(jid, [objetivo], 'remove');
    await sock.sendMessage(jid, { text: 'Usuario expulsado del grupo.' });
  }
};

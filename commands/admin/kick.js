module.exports = {
  name: 'kick',
  category: 'admin',
  description: 'Expulsar (mencion o responde)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const metadata = await sock.groupMetadata(jid);
    const participante = metadata.participants.find(p => p.id === msg.key.participant);
    const botId = sock.user.id.replace(/:\d+/, '');
    const esAdminBot = metadata.participants.find(
      p => p.phoneNumber === botId || p.id === botId
    )?.admin;

    if (!participante?.admin) {
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

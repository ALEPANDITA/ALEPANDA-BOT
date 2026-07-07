module.exports = {
  name: 'cerrar',
  category: 'admin',
  description: 'Cerrar grupo (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const metadata = await sock.groupMetadata(jid);
    const participante = metadata.participants.find(p => p.id === msg.key.participant);
    const botId = sock.user.id.replace(/:\d+/, '');
    const esAdminBot = metadata.participants.find(
      p => p.phoneNumber === botId || p.id === botId
    )?.admin;

    if (participante?.admin) {
      if (esAdminBot) {
        await sock.groupSettingUpdate(jid, 'announcement');
        await sock.sendMessage(jid, { text: 'Grupo cerrado. Solo admins pueden escribir.' });
      } else {
        await sock.sendMessage(jid, { text: 'Necesito ser admin para hacer esto.' });
      }
    } else {
      await sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }
  }
};

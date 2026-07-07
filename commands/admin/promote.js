async function cambiarAdmin(sock, jid, msg, accion) {
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
    return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con .promote / .demote' });
  }

  await sock.groupParticipantsUpdate(jid, [objetivo], accion);
  const texto = accion === 'promote' ? 'Usuario ahora es admin.' : 'Se le quito el admin al usuario.';
  await sock.sendMessage(jid, { text });
}

module.exports = [
  {
    name: 'promote',
    category: 'admin',
    description: 'Dar admin',
    groupOnly: true,
    execute: (sock, jid, msg) => cambiarAdmin(sock, jid, msg, 'promote')
  },
  {
    name: 'demote',
    category: 'admin',
    description: 'Quitar admin',
    groupOnly: true,
    execute: (sock, jid, msg) => cambiarAdmin(sock, jid, msg, 'demote')
  }
];

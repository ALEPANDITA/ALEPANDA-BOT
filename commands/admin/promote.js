const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

async function cambiarAdmin(sock, jid, msg, accion) {
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
    return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con .promote / .demote' });
  }

  await sock.groupParticipantsUpdate(jid, [objetivo], accion);
  const texto = accion === 'promote' ? 'Usuario ahora es admin.' : 'Se le quito el admin al usuario.';
  await sock.sendMessage(jid, { text: texto });
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

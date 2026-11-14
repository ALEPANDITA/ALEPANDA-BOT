const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');

async function cambiarAdmin(sock, jid, msg, accion) {
  const remitente = msg.key.participant || msg.key.remoteJid;
  const { esAdmin, esAdminReal, esSuperOwner, participante } = await esAdminDelGrupo(sock, jid, remitente, msg);
  const esAdminBot = await esAdminDelBot(sock, jid);

  if (!esAdmin) {
    return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
  }
  if (!esAdminBot) {
    return sock.sendMessage(jid, { text: 'Necesito ser admin para hacer esto.' });
  }

  const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
  let objetivo = mencionado || citado;
  let esAMiMismo = false;

  // El super owner puede darse o quitarse el admin aunque no lo sea: .promote / .demote sin mencionar a nadie lo aplica a el mismo
  if (!objetivo && esSuperOwner) {
    if (!participante) {
      return sock.sendMessage(jid, { text: 'No te encuentro en este grupo, así que no puedo cambiarte el admin.' });
    }
    objetivo = participante.id || remitente;
    esAMiMismo = true;
  }

  if (!objetivo) {
    return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con .promote / .demote' });
  }

  if (esAMiMismo) {
    if (accion === 'promote' && esAdminReal) return sock.sendMessage(jid, { text: 'Ya eres admin de este grupo. 👑' });
    if (accion === 'demote' && !esAdminReal) return sock.sendMessage(jid, { text: 'Ya no eres admin de este grupo.' });
  }

  await sock.groupParticipantsUpdate(jid, [objetivo], accion);
  const texto = esAMiMismo
    ? (accion === 'promote' ? 'Listo, ahora eres admin de este grupo. 👑' : 'Listo, ya no eres admin de este grupo.')
    : (accion === 'promote' ? 'Usuario ahora es admin.' : 'Se le quito el admin al usuario.');
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

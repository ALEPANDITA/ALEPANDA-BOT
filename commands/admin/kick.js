const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

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
      return sock.sendMessage(jid, { text: advertencia('Solo un admin puede usar este comando.', { titulo: 'SIN PERMISOS' }) });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: advertencia('Necesito ser admin para hacer esto.', { titulo: 'ME FALTAN PERMISOS' }) });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: advertencia('Menciona a alguien o responde su mensaje con .kick', { titulo: 'FALTA EL USUARIO' }) });
    }

    await sock.groupParticipantsUpdate(jid, [objetivo], 'remove');
    await sock.sendMessage(jid, { text: exito('Usuario expulsado del grupo.', { titulo: 'KICK' }) });
  }
};

const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'tagall',
  category: 'admin',
  description: 'Menciona a todos los miembros del grupo',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const metadata = await sock.groupMetadata(jid);
    const participantes = metadata.participants.map(p => p.id);

    const partes = (texto || '').trim().split(/\s+/);
    const mensaje = partes.slice(1).join(' ') || '📢 Atencion a todos!';

    let listado = participantes.map(id => `@${id.split('@')[0]}`).join('\n');

    await sock.sendMessage(jid, {
      text: `${mensaje}\n\n${listado}`,
      mentions: participantes
    });
  }
};

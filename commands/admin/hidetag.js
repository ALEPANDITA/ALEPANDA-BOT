const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'hidetag',
  category: 'admin',
  description: 'Menciona a todos sin mostrar la lista de numeros',
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

    await sock.sendMessage(jid, {
      text: mensaje,
      mentions: participantes
    });
  }
};

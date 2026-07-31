const { leerConfig } = require('../../lib/config');
const { esAdminDelGrupo, esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'n',
  category: 'admin',
  description: 'Manda un mensaje etiquetando a todos de forma silenciosa, sin mostrar la lista de usuarios (solo admin/owner)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;

    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esOwner = await esOwnerBot(sock, config, msg);

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    const mensaje = texto.slice((prefix + 'n').length).trim();

    if (!mensaje) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}n <mensaje>` });
    }

    const textoFinal = `📢 *MENSAJE DE LOS ADMINS IMPORTANTE*\n👇👇👇\n\n${mensaje}`;

    try {
      const metadata = await sock.groupMetadata(jid);
      const botNumero = (sock.user?.id || '').split(':')[0];
      const participantes = metadata.participants
        .map(p => p.id)
        .filter(id => id.split('@')[0] !== botNumero);

      await sock.sendMessage(jid, { text: textoFinal, mentions: participantes });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al mandar el mensaje.' });
    }
  }
};

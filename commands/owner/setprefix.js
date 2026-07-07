const { leerConfig, guardarConfig } = require('../../lib/config');

module.exports = {
  name: 'setprefix',
  category: 'owner',
  description: 'Cambiar prefijo (solo admin del grupo)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const esGrupo = jid.endsWith('@g.us');

    if (!esGrupo) {
      return sock.sendMessage(jid, { text: 'Este comando solo funciona dentro de un grupo.' });
    }

    const metadata = await sock.groupMetadata(jid);
    const remitente = msg.key.participant || msg.key.remoteJid;
    const participante = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente);

    if (!participante?.admin) {
      return sock.sendMessage(jid, { text: 'Solo un admin del grupo puede cambiar el prefijo.' });
    }

    const config = leerConfig();
    const nuevoPrefix = texto.slice((prefix + 'setprefix ').length).trim();

    if (!nuevoPrefix) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}setprefix <nuevo prefijo>\nEjemplo: ${prefix}setprefix !` });
    }

    config.prefix = nuevoPrefix;
    guardarConfig(config);
    await sock.sendMessage(jid, { text: `Prefijo cambiado a: ${nuevoPrefix}` });
  }
};

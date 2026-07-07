const { leerConfig, guardarConfig } = require('../../lib/config');

module.exports = {
  name: 'delowner',
  category: 'owner',
  description: 'Quitar owner (solo dueno principal)',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (remitente !== config.mainOwner) {
      return sock.sendMessage(jid, { text: 'Solo el dueno principal puede quitar owners.' });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona a alguien o responde su mensaje con ${prefix}delowner` });
    }

    if (objetivo === config.mainOwner) {
      return sock.sendMessage(jid, { text: 'No puedes quitarte a ti mismo como dueno principal.' });
    }

    if (!config.owners.includes(objetivo)) {
      return sock.sendMessage(jid, { text: 'Esa persona no es owner.' });
    }

    config.owners = config.owners.filter(o => o !== objetivo);
    guardarConfig(config);
    await sock.sendMessage(jid, { text: 'Usuario eliminado de la lista de owners.' });
  }
};

const { leerConfig, guardarConfig } = require('../../lib/config');

module.exports = {
  name: 'setowner',
  category: 'owner',
  description: 'Ponerte de dueno principal o agregar owners',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.mainOwner) {
      config.mainOwner = remitente;
      config.owners = [remitente];
      guardarConfig(config);
      return sock.sendMessage(jid, { text: 'Listo, ahora eres el dueno principal del bot.' });
    }

    if (remitente !== config.mainOwner) {
      return sock.sendMessage(jid, { text: 'Solo el dueno principal puede agregar nuevos owners.' });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona a alguien o responde su mensaje con ${prefix}setowner` });
    }

    if (config.owners.includes(objetivo)) {
      return sock.sendMessage(jid, { text: 'Esa persona ya es owner.' });
    }

    config.owners.push(objetivo);
    guardarConfig(config);
    await sock.sendMessage(jid, { text: 'Usuario agregado como owner del bot.' });
  }
};

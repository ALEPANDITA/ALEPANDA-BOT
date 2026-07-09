const { leerConfig, guardarConfig } = require('../../lib/config');
const { resolverLid, mismoUsuario } = require('../../lib/permisos');

module.exports = {
  name: 'setowner',
  category: 'owner',
  description: 'Ponerte de dueno principal o agregar owners',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;
    const remitenteResuelto = await resolverLid(sock, remitente);

    if (!config.mainOwner) {
      config.mainOwner = remitenteResuelto;
      config.owners = [remitenteResuelto];
      guardarConfig(config);
      return sock.sendMessage(jid, { text: 'Listo, ahora eres el dueno principal del bot.' });
    }

    if (!mismoUsuario(remitente, config.mainOwner) && !mismoUsuario(remitenteResuelto, config.mainOwner)) {
      return sock.sendMessage(jid, { text: 'Solo el dueno principal puede agregar nuevos owners.' });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona a alguien o responde su mensaje con ${prefix}setowner` });
    }

    const objetivoResuelto = await resolverLid(sock, objetivo);

    if (config.owners.some(o => mismoUsuario(o, objetivoResuelto))) {
      return sock.sendMessage(jid, { text: 'Esa persona ya es owner.' });
    }

    config.owners.push(objetivoResuelto);
    guardarConfig(config);
    await sock.sendMessage(jid, { text: 'Usuario agregado como owner del bot.' });
  }
};

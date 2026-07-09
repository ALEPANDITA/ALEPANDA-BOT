const { leerConfig, guardarConfig } = require('../../lib/config');
const { resolverLid, mismoUsuario } = require('../../lib/permisos');

module.exports = {
  name: 'delowner',
  category: 'owner',
  description: 'Quitar owner (solo dueno principal)',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;
    const remitenteResuelto = await resolverLid(sock, remitente);

    if (!mismoUsuario(remitente, config.mainOwner) && !mismoUsuario(remitenteResuelto, config.mainOwner)) {
      return sock.sendMessage(jid, { text: 'Solo el dueno principal puede quitar owners.' });
    }

    const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona a alguien o responde su mensaje con ${prefix}delowner` });
    }

    const objetivoResuelto = await resolverLid(sock, objetivo);

    if (mismoUsuario(objetivoResuelto, config.mainOwner)) {
      return sock.sendMessage(jid, { text: 'No puedes quitarte a ti mismo como dueno principal.' });
    }

    if (!config.owners.some(o => mismoUsuario(o, objetivoResuelto))) {
      return sock.sendMessage(jid, { text: 'Esa persona no es owner.' });
    }

    config.owners = config.owners.filter(o => !mismoUsuario(o, objetivoResuelto));
    guardarConfig(config);
    await sock.sendMessage(jid, { text: 'Usuario eliminado de la lista de owners.' });
  }
};

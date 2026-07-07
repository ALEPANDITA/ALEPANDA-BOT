const { leerConfig } = require('../../lib/config');
const { setApiKey } = require('../../lib/apikeys');

module.exports = {
  name: 'setapikey',
  category: 'owner',
  description: 'Guarda la clave de una API (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.owners || !config.owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const partes = texto.trim().split(/\s+/);
    const servicio = partes[1];
    const clave = partes[2];

    if (!servicio || !clave) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}setapikey <servicio> <clave>\nEjemplo: ${prefix}setapikey instagram TU_CLAVE_AQUI`
      });
    }

    setApiKey(servicio.toLowerCase(), clave);
    await sock.sendMessage(jid, { text: `Clave guardada para el servicio: ${servicio}` });
  }
};

const { leerConfig } = require('../../lib/config');
const { setApiKey } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'setapikey',
  category: 'owner',
  description: 'Guarda la clave de una API (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = texto.trim().split(/\s+/);
    const servicio = partes[1];
    const clave = partes[2];

    if (!servicio || !clave) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}setapikey <servicio> <clave>\nEjemplo: ${prefix}setapikey instagram TU_CLAVE_AQUI`, { titulo: 'FALTA INFORMACION', estilo: 'neon' })
      });
    }

    setApiKey(servicio.toLowerCase(), clave);
    await sock.sendMessage(jid, {
      text: exito(`Clave guardada para el servicio: *${servicio}*`, { titulo: 'API KEY GUARDADA', estilo: 'neon' })
    });
  }
};

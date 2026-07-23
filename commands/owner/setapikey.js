const { leerConfig } = require('../../lib/config');
const { agregarApiKey } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'setapikey',
  category: 'owner',
  description: 'Agrega una clave de API a un servicio (solo owner). Se pueden guardar varias claves para el mismo servicio.',
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
        text: advertencia(
          `Uso: ${prefix}setapikey <servicio> <clave>\nEjemplo: ${prefix}setapikey gemini TU_CLAVE_AQUI\n\nPuedes usar este comando varias veces con el mismo servicio para agregar mas claves (ej. varias de Gemini). Cuando una se quede sin cuota, el bot pasara automaticamente a la siguiente.\n\nUsa ${prefix}delapikey <servicio> <numero> para quitar una clave, y ${prefix}apistatus para ver la lista.`,
          { titulo: 'FALTA INFORMACION', estilo: 'neon' }
        )
      });
    }

    const listaActual = agregarApiKey(servicio.toLowerCase(), clave);
    await sock.sendMessage(jid, {
      text: exito(
        `Clave guardada para el servicio: *${servicio}*\nAhora hay *${listaActual.length}* clave(s) guardada(s) para este servicio.`,
        { titulo: 'API KEY GUARDADA', estilo: 'neon' }
      )
    });
  }
};

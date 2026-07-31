const { leerConfig } = require('../../lib/config');
const { quitarApiKey, getApiKeys } = require('../../lib/apikeys');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'delapikey',
  category: 'owner',
  description: 'Elimina una clave guardada de un servicio, por su numero de lista (solo owner)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = texto.trim().split(/\s+/);
    const servicio = partes[1]?.toLowerCase();
    const numero = partes[2];

    if (!servicio || !numero) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Uso: ${prefix}delapikey <servicio> <numero>\nEjemplo: ${prefix}delapikey gemini 2\n\nUsa ${prefix}apistatus para ver el numero de cada clave.`,
          { titulo: 'FALTA INFORMACION', estilo: 'neon' }
        )
      });
    }

    const eliminada = quitarApiKey(servicio, numero);

    if (!eliminada) {
      return sock.sendMessage(jid, {
        text: advertencia(`No encontre la clave numero *${numero}* en el servicio *${servicio}*.`, { titulo: 'NO ENCONTRADA', estilo: 'neon' })
      });
    }

    const restantes = getApiKeys(servicio).length;
    await sock.sendMessage(jid, {
      text: exito(
        `Clave eliminada del servicio *${servicio}*.\nQuedan *${restantes}* clave(s) guardada(s).`,
        { titulo: 'API KEY ELIMINADA', estilo: 'neon' }
      )
    });
  }
};

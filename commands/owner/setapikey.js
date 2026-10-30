const { leerConfig } = require('../../lib/config');
const { agregarApiKey, leerKeys, SERVICIOS_CONOCIDOS, servicioParecido } = require('../../lib/apikeys');
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

    const prefEscapado = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const resto = texto.replace(new RegExp(`^\\s*${prefEscapado}\\s*setapikey\\s*`, 'i'), '').trim();
    const partes = resto.split(/\s+/).filter(Boolean);
    const servicio = partes[0];
    const clave = partes[1];

    if (!servicio || !clave) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Uso: ${prefix}setapikey <servicio> <clave>\nEjemplo: ${prefix}setapikey gemini TU_CLAVE_AQUI\n\nPuedes usar este comando varias veces con el mismo servicio para agregar mas claves (ej. varias de Gemini). Cuando una se quede sin cuota, el bot pasara automaticamente a la siguiente.\n\nUsa ${prefix}delapikey <servicio> <numero> para quitar una clave, y ${prefix}apistatus para ver la lista.`,
          { titulo: 'FALTA INFORMACION', estilo: 'neon' }
        )
      });
    }

    const nombre = servicio.toLowerCase();
    const forzar = /^(forzar|force)$/i.test(partes[2] || '');
    const yaExiste = Object.prototype.hasOwnProperty.call(leerKeys(), nombre);

    // Si el nombre no es de un servicio que el bot usa (ej. "gorq" en vez de "groq"), no se guarda
    if (!forzar && !yaExiste && !SERVICIOS_CONOCIDOS.includes(nombre)) {
      const parecido = servicioParecido(nombre);
      const sugerencia = parecido
        ? `¿Quisiste decir *${parecido}*?\nUsa: ${prefix}setapikey ${parecido} TU_CLAVE`
        : `Servicios validos:\n${SERVICIOS_CONOCIDOS.join(', ')}`;
      return sock.sendMessage(jid, {
        text: advertencia(
          `No existe el servicio *${servicio}*, no guarde nada.\n\n${sugerencia}\n\n(Si de verdad es un servicio nuevo, agrega la palabra *forzar* al final.)`,
          { titulo: 'SERVICIO DESCONOCIDO', estilo: 'neon' }
        )
      });
    }

    const listaActual = agregarApiKey(nombre, clave);
    await sock.sendMessage(jid, {
      text: exito(
        `Clave guardada para el servicio: *${nombre}*\nAhora hay *${listaActual.length}* clave(s) guardada(s) para este servicio.`,
        { titulo: 'API KEY GUARDADA', estilo: 'neon' }
      )
    });
  }
};

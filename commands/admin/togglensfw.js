const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esOwnerBot } = require('../../lib/permisos');
const { leerConfig } = require('../../lib/config');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'togglensfw',
  aliases: ['tnsfw'],
  category: 'admin',
  description: 'Activa o desactiva los comandos NSFW en el grupo (solo owner). Uso: .tnsfw on / off',
  menuOwner: true, // sale en .menuowner, no en .menu
  silencioNoOwner: true, // a quien no es owner ni se le responde
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      // Solo un owner decide si un grupo tiene NSFW (igual en subbots, que no revisan silencioNoOwner)
      if (!(await esOwnerBot(sock, leerConfig(), msg))) return;

      // Un menor de 18 registrado no puede activarlo ni desactivarlo
      const nsfw = require('../../lib/nsfw');
      if (await nsfw.esMenorRegistrado(sock, jid, msg)) return await sock.sendMessage(jid, { text: nsfw.TEXTO_MENOR }, { quoted: msg });

      if (!jid.endsWith('@g.us')) {
        return await sock.sendMessage(jid, { text: advertencia('Este comando solo se puede usar dentro de un grupo.') });
      }

      const db = leerDB();
      const grupo = getGrupo(db, jid);

      const args = texto.trim().split(/\s+/).slice(1);
      const opcion = args[0]?.toLowerCase();

      let nuevoEstado;
      if (opcion === 'on' || opcion === 'activar') {
        nuevoEstado = true;
      } else if (opcion === 'off' || opcion === 'desactivar') {
        nuevoEstado = false;
      } else {
        // Sin argumento: cambia al contrario del estado actual
        nuevoEstado = !grupo.nsfw;
      }

      grupo.nsfw = Boolean(nuevoEstado);
      grupo.animeimg = Boolean(nuevoEstado);

      // Guardar cambios en la base de datos asegurando persistencia
      guardarDB(db);

      const estadoTexto = nuevoEstado ? 'ACTIVADOS' : 'DESACTIVADOS';
      const mensajeRespuesta = nuevoEstado
        ? `🔞 *NSFW ACTIVADO* en este grupo.\nSolo los pueden usar personas registradas con 18 años o más.\nPara apagarlo: *${prefix}tnsfw off*`
        : `🔒 *NSFW DESACTIVADO* en este grupo.\nPara activarlo: *${prefix}tnsfw on*`;

      await sock.sendMessage(jid, { text: mensajeRespuesta });

    } catch (err) {
      console.error('Error en togglensfw:', err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al cambiar la configuración de NSFW.') });
    }
  }
};
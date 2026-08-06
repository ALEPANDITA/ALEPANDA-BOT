const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'togglensfw',
  aliases: ['tnsfw'],
  category: 'admin',
  description: 'Activa o desactiva los comandos NSFW y Anime (animeimg) en el grupo. Uso: .tnsfw [on/off]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      if (!jid.endsWith('@g.us')) {
        return await sock.sendMessage(jid, { text: advertencia('Este comando solo se puede usar dentro de un grupo.') });
      }

      const remitente = msg.key.participant || msg.participant || msg.key.remoteJid || '';
      if (!remitente) {
        return await sock.sendMessage(jid, { text: cajaError('No se pudo determinar el remitente del mensaje.') });
      }

      const esAdmin = await esAdminDelGrupo(sock, jid, remitente);
      if (!esAdmin) {
        return await sock.sendMessage(jid, { text: advertencia('Solo los administradores pueden usar este comando.') });
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
        // Alternar el estado actual basado en nsfw si no se pasa argumento
        nuevoEstado = !grupo.nsfw;
      }

      // Asegurar que tanto nsfw como animeimg se actualicen de forma explícita y se sincronicen en la estructura del grupo
      grupo.nsfw = Boolean(nuevoEstado);
      grupo.animeimg = Boolean(nuevoEstado);

      // Guardar cambios en la base de datos asegurando persistencia
      guardarDB(db);

      const estadoTexto = nuevoEstado ? 'ACTIVADOS' : 'DESACTIVADOS';
      const mensajeRespuesta = `⚙️ *CONFIGURACIÓN ACTUALIZADA*\n\nLos comandos de las categorías *NSFW* y *Anime (animeimg)* ahora están *${estadoTexto}* en este grupo.`;

      await sock.sendMessage(jid, { text: mensajeRespuesta });

    } catch (err) {
      console.error('Error en togglensfw:', err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al cambiar la configuración de NSFW.') });
    }
  }
};
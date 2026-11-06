const { leerConfig } = require('../../lib/config');
const { borrarMenu } = require('../../lib/menumedia');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, info } = require('../../lib/estilo');

module.exports = {
  name: 'delmenuimg',
  category: 'owner',
  description: 'Elimina la imagen del menu de ESTE grupo (solo owner). En privado borra la del menu general',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const { borrado, deGrupo } = borrarMenu(jid, 'img');
    if (borrado) {
      return sock.sendMessage(jid, { text: exito(deGrupo ? 'Imagen del menu de este grupo eliminada. Se usara la del menu general (o texto simple).' : 'Imagen del menu general eliminada.', { titulo: 'MENU ACTUALIZADO', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, { text: info('No hay ninguna imagen configurada.', { titulo: 'MENU', estilo: 'neon' }) });
  }
};

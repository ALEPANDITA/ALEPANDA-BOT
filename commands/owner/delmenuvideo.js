const { leerConfig } = require('../../lib/config');
const { borrarMenu } = require('../../lib/menumedia');
const { esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'delmenuvideo',
  category: 'owner',
  description: 'Elimina el video del menu de ESTE grupo (solo owner). En privado borra el del menu general',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const { borrado, deGrupo } = borrarMenu(jid, 'vid');
    if (borrado) {
      return sock.sendMessage(jid, { text: deGrupo ? 'Video del menu de este grupo eliminado. Se usara la imagen del grupo, la del menu general o texto simple.' : 'Video del menu general eliminado. Se usara la imagen (si existe) o texto simple.' });
    }

    await sock.sendMessage(jid, { text: 'No hay ningun video configurado.' });
  }
};

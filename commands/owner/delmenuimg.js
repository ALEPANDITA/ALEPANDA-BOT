const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, info } = require('../../lib/estilo');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');

module.exports = {
  name: 'delmenuimg',
  category: 'owner',
  description: 'Elimina la imagen del menu (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      return sock.sendMessage(jid, { text: exito('Imagen del menu eliminada. Se usara texto simple.', { titulo: 'MENU ACTUALIZADO', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, { text: info('No hay ninguna imagen configurada.', { titulo: 'MENU', estilo: 'neon' }) });
  }
};

const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');
const { esOwnerBot } = require('../../lib/permisos');

const videoPath = path.join(__dirname, '..', '..', 'assets', 'menu.mp4');

module.exports = {
  name: 'delmenuvideo',
  category: 'owner',
  description: 'Elimina el video del menu (solo owner). Vuelve a usar la imagen o texto simple.',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      return sock.sendMessage(jid, { text: 'Video del menu eliminado. Se usara la imagen (si existe) o texto simple.' });
    }

    await sock.sendMessage(jid, { text: 'No hay ningun video configurado.' });
  }
};

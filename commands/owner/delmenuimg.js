const { leerConfig } = require('../../lib/config');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');

module.exports = {
  name: 'delmenuimg',
  category: 'owner',
  description: 'Elimina la imagen del menu (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.owners || !config.owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      return sock.sendMessage(jid, { text: 'Imagen del menu eliminada. Se usara texto simple.' });
    }

    await sock.sendMessage(jid, { text: 'No hay ninguna imagen configurada.' });
  }
};

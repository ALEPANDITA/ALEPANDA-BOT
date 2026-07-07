const { leerConfig } = require('../../lib/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');

module.exports = {
  name: 'setmenuimg',
  category: 'owner',
  description: 'Cambia la imagen del menu (responde a una imagen, solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const remitente = msg.key.participant || msg.key.remoteJid;

    if (!config.owners || !config.owners.includes(remitente)) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' });
    }

    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, { text: 'Responde a una imagen con este comando (o envia la imagen con el comando en el texto).' });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      fs.writeFileSync(imagePath, buffer);
      await sock.sendMessage(jid, { text: 'Imagen del menu actualizada correctamente.' });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'No se pudo guardar la imagen.' });
    }
  }
};

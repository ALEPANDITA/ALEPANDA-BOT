const { leerConfig } = require('../../lib/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError } = require('../../lib/estilo');

const imagePath = path.join(__dirname, '..', '..', 'assets', 'menu.jpg');

module.exports = {
  name: 'setmenuimg',
  category: 'owner',
  description: 'Cambia la imagen del menu (responde a una imagen, solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, { text: advertencia('Responde a una imagen con este comando.', { titulo: 'FALTA LA IMAGEN', estilo: 'neon' }) });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      fs.writeFileSync(imagePath, buffer);
      await sock.sendMessage(jid, { text: exito('Imagen del menu actualizada correctamente.', { titulo: 'MENU ACTUALIZADO', estilo: 'neon' }) });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo guardar la imagen.', { estilo: 'neon' }) });
    }
  }
};

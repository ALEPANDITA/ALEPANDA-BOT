const { leerConfig } = require('../../lib/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError } = require('../../lib/estilo');

const videoPath = path.join(__dirname, '..', '..', 'assets', 'menu.mp4');
const LIMITE_SEGUNDOS = 15;

module.exports = {
  name: 'setmenuvideo',
  category: 'owner',
  description: 'Fija el video del menu (responde a un video, solo owner). Se usa en todos los grupos hasta que se cambie de nuevo.',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const videoMessage = citado?.videoMessage || msg.message.videoMessage;
    const mensajeConVideo = citado?.videoMessage
      ? { message: citado }
      : msg.message.videoMessage
        ? msg
        : null;

    if (!mensajeConVideo) {
      return sock.sendMessage(jid, { text: advertencia('Responde a un video con este comando.', { titulo: 'FALTA EL VIDEO', estilo: 'neon' }) });
    }

    const duracion = videoMessage.seconds || 0;
    if (duracion > LIMITE_SEGUNDOS) {
      return sock.sendMessage(jid, {
        text: advertencia(`El video dura ${duracion}s, el maximo permitido es ${LIMITE_SEGUNDOS}s.`, { titulo: 'VIDEO MUY LARGO', estilo: 'neon' })
      });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConVideo, 'buffer', {});
      fs.writeFileSync(videoPath, buffer);
      await sock.sendMessage(jid, {
        text: exito(
          'Video del menu actualizado correctamente. Se reproducira en bucle automatico (tipo GIF) en todos los grupos hasta que lo cambies de nuevo.\n\nEste archivo tambien queda guardado dentro del proyecto (assets/menu.mp4), asi que si subes cambios a GitHub o mueves el bot a otro servidor, el video se mantiene igual a menos que tu lo reemplaces.',
          { titulo: 'MENU ACTUALIZADO', estilo: 'neon' }
        )
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo guardar el video.', { estilo: 'neon' }) });
    }
  }
};

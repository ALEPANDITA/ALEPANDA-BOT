const { leerConfig } = require('../../lib/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { guardarMenu } = require('../../lib/menumedia');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError } = require('../../lib/estilo');

const LIMITE_SEGUNDOS = 15;

module.exports = {
  name: 'setmenuvideo',
  category: 'owner',
  description: 'Fija el video del menu de ESTE grupo (responde a un video, solo owner). En privado cambia el menu general',
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
      const deGrupo = guardarMenu(jid, 'vid', buffer);
      await sock.sendMessage(jid, {
        text: exito(
          deGrupo
            ? 'Video del menu actualizado SOLO en este grupo (se reproduce en bucle tipo GIF). Los demas grupos no cambian.'
            : 'Video del menu general actualizado (lo usan los chats y los grupos que no tengan uno propio).',
          { titulo: 'MENU ACTUALIZADO', estilo: 'neon' }
        )
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo guardar el video.', { estilo: 'neon' }) });
    }
  }
};

const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'ver',
  category: 'fun',
  description: 'Responde a un mensaje "ver una vez" con .ver para reenviarlo como normal',
  execute: async (sock, jid, msg) => {
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!citado) {
      return sock.sendMessage(jid, {
        text: 'Responde (cita) al mensaje de "ver una vez" con .ver para reenviarlo.'
      });
    }

    // Los mensajes de ver-una-vez vienen envueltos en viewOnceMessage,
    // viewOnceMessageV2 o viewOnceMessageV2Extension, o marcados con viewOnce: true.
    const contenidoReal =
      citado.viewOnceMessageV2?.message ||
      citado.viewOnceMessageV2Extension?.message ||
      citado.viewOnceMessage?.message ||
      citado;

    const imagen = contenidoReal?.imageMessage;
    const video = contenidoReal?.videoMessage;

    if (!imagen && !video) {
      return sock.sendMessage(jid, {
        text: 'Ese mensaje citado no es una imagen o video de "ver una vez".'
      });
    }

    try {
      const mensajeParaDescargar = { message: contenidoReal };
      const buffer = await downloadMediaMessage(mensajeParaDescargar, 'buffer', {});

      if (imagen) {
        await sock.sendMessage(jid, {
          image: buffer,
          caption: imagen.caption || ''
        });
      } else {
        await sock.sendMessage(jid, {
          video: buffer,
          caption: video.caption || ''
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: 'No se pudo recuperar el contenido. Puede que ya se haya abierto o que el mensaje sea muy viejo.'
      });
    }
  }
};

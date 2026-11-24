const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'tovideo',
  aliases: ['stickeraudio', 'vsticker'],
  category: 'stickers',
  description: 'Convierte un video o GIF citado en sticker animado (sin audio). Uso: .tovideo (cita el video/gif)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Verificar si el mensaje cita un medio
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return sock.sendMessage(jid, { text: advertencia(`Debes citar un video, GIF o audio junto al comando.\nEjemplo: ${prefix}tovideo (cita el video)`, { titulo: 'USO INCORRECTO' }) });
    }

    // Determinar tipo de medio soportado
    const mediaMessage = quoted.videoMessage || quoted.imageMessage || quoted.gifMessage || quoted.stickerMessage;
    if (!mediaMessage) {
      return sock.sendMessage(jid, { text: advertencia('El mensaje citado no contiene un video, GIF o imagen compatible.', { titulo: 'MEDIO NO SOPORTADO' }) });
    }

    try {
      // Descargar el archivo multimedia
      const stream = await sock.downloadMediaMessage({ message: { [Object.keys(quoted)[0]]: quoted[Object.keys(quoted)[0]] } });
      const buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // Enviar como sticker animado (si es video/gif)
      const isAnimated = !!quoted.videoMessage || !!quoted.gifMessage;
      const stickerPayload = isAnimated
        ? { sticker: { url: `data:${mediaMessage.mimetype};base64,${buffer.toString('base64')}` } }
        : { sticker: { url: `data:${mediaMessage.mimetype};base64,${buffer.toString('base64')}` } };

      await sock.sendMessage(jid, stickerPayload);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Error al procesar el sticker: ' + err.message) });
    }
  }
};
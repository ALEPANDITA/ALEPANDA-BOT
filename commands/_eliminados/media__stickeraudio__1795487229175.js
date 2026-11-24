const { error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'stickeraudio',
  aliases: ['sta'],
  category: 'media',
  description: 'Convierte el audio citado en un sticker animado. Uso: .stickeraudio (responde a un audio)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Verificar que el mensaje cite un audio
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted || !quoted.audioMessage) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}stickeraudio (responde a un audio)`, { titulo: 'FALTA AUDIO COTIZADO' }) });
    }

    try {
      // Obtener la URL del audio (Baileys provee la URL en el objeto)
      const audioUrl = quoted.audioMessage.url;
      if (!audioUrl) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la URL del audio citado.') });
      }

      // Descargar el audio
      const res = await fetch(audioUrl);
      if (!res.ok) {
        return sock.sendMessage(jid, { text: cajaError('Error al descargar el audio.') });
      }
      const audioBuffer = await res.buffer();

      // NOTA: La conversión a sticker animado requiere ffmpeg, lo cual no está permitido usar child_process.
      // Por lo tanto, enviamos una notificación indicando que la funcionalidad no está disponible.
      await sock.sendMessage(jid, { text: cajaError('Conversión a sticker animado no está implementada en este momento.') });

      // Si en el futuro se agrega soporte, aquí se procesaría audioBuffer con ffmpeg y se enviaría el sticker:
      // const stickerBuffer = await convertirAudioASticker(audioBuffer);
      // await sock.sendMessage(jid, { sticker: stickerBuffer });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar el audio: ' + err.message) });
    }
  }
};
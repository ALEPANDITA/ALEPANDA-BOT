const { generarImagen } = require('../../lib/gemini');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'imagen',
  category: 'ia',
  description: 'Genera una imagen con IA a partir de una descripcion, o edita una imagen si respondes a ella. Ej: .imagen un gato astronauta',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const descripcion = texto.slice((prefix + 'imagen ').length).trim();

    // Si el comando responde a una imagen (o la manda junto con el caption), la editamos en vez de crear una nueva
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message?.imageMessage
        ? msg
        : null;

    if (!descripcion) {
      return sock.sendMessage(jid, {
        text: mensajeConImagen
          ? `Uso: ${prefix}imagen <como quieres que la cambie>\nEjemplo: ${prefix}imagen ponle un sombrero de mago`
          : `Uso: ${prefix}imagen <descripcion>\nEjemplo: ${prefix}imagen un panda programando en una laptop\n\nTambien puedes responder a una imagen con ${prefix}imagen <cambio que quieres> para EDITARLA en vez de crear una nueva.`
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } });

      let imagenEntrada;
      if (mensajeConImagen) {
        const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
        imagenEntrada = { base64: buffer.toString('base64'), mimeType: 'image/jpeg' };
      }

      const resultado = await generarImagen(descripcion, imagenEntrada);
      await sock.sendMessage(jid, { image: resultado, caption: `🎨 ${descripcion}` }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, {
          text: `No hay una API key de Gemini configurada.\nUn owner puede activarla con: ${prefix}setapikey gemini TU_CLAVE`
        }, { quoted: msg });
      }
      console.error(err);
      await sock.sendMessage(jid, { text: `Ocurrio un error generando la imagen: ${err.message}` }, { quoted: msg });
    }
  }
};

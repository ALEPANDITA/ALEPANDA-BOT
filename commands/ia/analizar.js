const { generarTexto } = require('../../lib/gemini');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'analizar',
  category: 'ia',
  description: 'Analiza/describe una imagen con IA (responde a una imagen con este comando)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message?.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, {
        text: `Responde a una imagen con ${prefix}analizar (o mandala junto con el comando en el texto/caption).`
      }, { quoted: msg });
    }

    const pregunta = texto.slice((prefix + 'analizar').length).trim() || 'Describe esta imagen con detalle, en español.';

    try {
      await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } });

      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      const imagenBase64 = buffer.toString('base64');

      const respuesta = await generarTexto(pregunta, { imagenBase64, mimeType: 'image/jpeg' });

      await sock.sendMessage(jid, { text: respuesta }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, {
          text: `No hay una API key de Gemini configurada.\nUn owner puede activarla con: ${prefix}setapikey gemini TU_CLAVE`
        }, { quoted: msg });
      }
      console.error(err);
      await sock.sendMessage(jid, { text: `Ocurrio un error analizando la imagen: ${err.message}` }, { quoted: msg });
    }
  }
};

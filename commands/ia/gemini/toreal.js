const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { generarImagen } = require('../../../lib/gemini');

const PROMPT_REALISTA = 'Convierte esta imagen en una fotografia hiperrealista, como si fuera tomada con una camara real. ' +
  'Mantén la misma pose, composicion, colores de ropa/objetos y el mismo encuadre, pero con piel, texturas, luz y sombras fotorrealistas, como una persona/escena real, no un dibujo ni una ilustracion.';

module.exports = {
  name: 'toreal',
  aliases: ['realista', 'hazlareal'],
  category: 'ia',
  description: 'Responde a una imagen (dibujo, anime, ilustracion) con .toreal para convertirla en una version fotorrealista',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, {
        text: `Responde a una imagen con ${prefix}toreal para convertirla en una version fotorrealista.\nTambien puedes agregar instrucciones extra, ej: ${prefix}toreal que tenga fondo de ciudad de noche`
      }, { quoted: msg });
    }

    const extra = texto.slice((prefix + 'toreal').length).trim()
      || texto.slice((prefix + 'realista').length).trim()
      || texto.slice((prefix + 'hazlareal').length).trim();

    const prompt = extra ? `${PROMPT_REALISTA}\n\nDetalle adicional pedido: ${extra}` : PROMPT_REALISTA;

    await sock.sendMessage(jid, { react: { text: '🪄', key: msg.key } });

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      const imagenEntrada = { base64: buffer.toString('base64'), mimeType: 'image/jpeg' };

      const resultado = await generarImagen(prompt, imagenEntrada);

      await sock.sendMessage(jid, { image: resultado, caption: '🪄 Version realista' }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      console.error('[toreal] error:', err);
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, {
          text: `No hay una API key de Gemini configurada.\nUn owner puede activarla con: ${prefix}setapikey gemini TU_CLAVE`
        }, { quoted: msg });
      }
      await sock.sendMessage(jid, { text: `No se pudo convertir la imagen: ${err.message}` }, { quoted: msg });
    }
  }
};

const { generarImagen } = require('../../lib/gemini');

module.exports = {
  name: 'imagen',
  category: 'ia',
  description: 'Genera una imagen con IA a partir de una descripcion. Ej: .imagen un gato astronauta',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const descripcion = texto.slice((prefix + 'imagen ').length).trim();

    if (!descripcion) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}imagen <descripcion>\nEjemplo: ${prefix}imagen un panda programando en una laptop`
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } });
      const buffer = await generarImagen(descripcion);
      await sock.sendMessage(jid, { image: buffer, caption: `🎨 ${descripcion}` }, { quoted: msg });
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

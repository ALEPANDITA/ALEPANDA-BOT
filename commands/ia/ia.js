const { generarTexto } = require('../../lib/gemini');

module.exports = {
  name: 'ia',
  category: 'ia',
  description: 'Habla con la IA (Gemini). Ej: .ia cual es la capital de Francia',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const pregunta = texto.slice((prefix + 'ia ').length).trim();

    if (!pregunta) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}ia <tu pregunta>\nEjemplo: ${prefix}ia recomiendame una pelicula de terror`
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🤔', key: msg.key } });
      const respuesta = await generarTexto(pregunta);
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
      await sock.sendMessage(jid, { text: `Ocurrio un error: ${err.message}` }, { quoted: msg });
    }
  }
};

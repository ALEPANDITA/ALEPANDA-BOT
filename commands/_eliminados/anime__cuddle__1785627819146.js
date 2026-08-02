const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'cuddle',
  aliases: ['acurrucar'],
  category: 'anime',
  description: 'Muestra una animación de acurrucarse. Uso: .cuddle [@usuario] o simplemente .cuddle',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      let mencion = mentionedJid[0] || null;

      const usuarioSender = msg.key.participant || jid;

      const res = await fetch('https://api.evogb.org/sfw/interaction?type=c&key=evogb-WPHlBOdu');
      
      if (!res.ok) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la animación de la API.') });
      }

      const data = await res.json();

      if (!data || !data.status || !data.result) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener la animación de la API.') });
      }

      let mensajeInteraccion = '';
      let menciones = [usuarioSender];

      const senderTag = `@${usuarioSender.split('@')[0]}`;

      if (mencion && mencion !== usuarioSender) {
        const targetTag = `@${mencion.split('@')[0]}`;
        mensajeInteraccion = `${senderTag} se acurruca tiernamente con ${targetTag}.`;
        menciones.push(mencion);
      } else {
        mensajeInteraccion = `${senderTag} busca un lugar calentito para acurrucarse. ¡Qué adorable!`;
      }

      await sock.sendMessage(jid, {
        video: { url: data.result },
        caption: mensajeInteraccion,
        gifPlayback: true,
        mentions: menciones
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al ejecutar el comando cuddle.') });
    }
  }
};
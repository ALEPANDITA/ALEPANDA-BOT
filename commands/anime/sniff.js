const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'trip',
  aliases: ['tropezar'],
  category: 'anime',
  description: 'Reacción de tropiezo o tropezar con alguien. Uso: .trip [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentionedJid[0] || null;

    try {
      const res = await fetch('https://api.evogb.org/sfw/interaction?type=trip&key=evogb-WPHlBOdu');
      if (!res.ok) throw new Error('Error al conectar con la API.');
      
      const json = await res.json();
      if (!json.status || !json.result) {
        throw new Error('La API no devolvió un resultado válido.');
      }

      const videoUrl = json.result;
      const sender = msg.key.participant || msg.key.remoteJid;
      let mensajeTexto = '';
      let mentions = [sender];

      if (target) {
        mensajeTexto = `@${sender.split('@')[0]} tropieza y cae encima de @${target.split('@')[0]} 💥`;
        mentions.push(target);
      } else {
        mensajeTexto = `@${sender.split('@')[0]} se tropieza y cae al suelo de la nada 💫`;
      }

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        gifPlayback: true,
        caption: mensajeTexto,
        mentions: mentions
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo procesar el comando trip: ' + err.message) });
    }
  }
};
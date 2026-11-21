const { advertencia, error: cajaError, cargando } = require('../../lib/estilo');
const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'bored',
  aliases: ['aburrido', 'aburrida'],
  category: 'anime',
  description: 'Reacción anime de aburrimiento. Uso: .bored [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Mostrar mensaje de carga opcional
    await sock.sendMessage(jid, { text: cargando('Obteniendo reacción...') });

    const senderJid = msg.key.participant || msg.key.remoteJid;
    const senderNum = senderJid.split('@')[0];
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    const mentions = [senderJid];
    let caption = `@${senderNum} está aburrido/a 🥱`;

    if (mentionedJids.length > 0 && mentionedJids[0] !== senderJid) {
      const targetJid = mentionedJids[0];
      const targetNum = targetJid.split('@')[0];
      mentions.push(targetJid);
      caption = `@${senderNum} está aburrido/a con @${targetNum} 🥱`;
    }

    // Función para obtener URL de gif/video de reacción
    const obtenerReaccion = async () => {
      // Intentar primero con evogb
      try {
        const res = await fetch('https://api.evogb.org/sfw/interaction?type=bored');
        if (res.ok) {
          const data = await res.json();
          if (data && data.status && data.result) {
            return { url: data.result };
          }
        }
      } catch (_) {
        // Ignorar error y pasar al fallback
      }
      // Fallback a nekos.best (gif)
      const fallbackRes = await fetch('https://nekos.best/api/v2/bored');
      if (!fallbackRes.ok) throw new Error('Fallback API failed');
      const fallbackData = await fallbackRes.json();
      if (fallbackData && fallbackData.results && fallbackData.results[0] && fallbackData.results[0].url) {
        return { url: fallbackData.results[0].url };
      }
      throw new Error('No se obtuvo URL válida');
    };

    try {
      const { url } = await obtenerReaccion();
      await sock.sendMessage(jid, {
        video: { url },
        gifPlayback: true,
        caption,
        mentions
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo obtener la reacción en este momento.')
      });
    }
  }
};
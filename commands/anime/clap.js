const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'clap',
  aliases: ['aplaudir'],
  category: 'anime',
  description: 'Envía una animación de aplausos. Uso: .clap [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    // Obtener remitente
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const senderTag = `@${senderJid.split('@')[0]}`;
    // Obtener menciones del mensaje
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetTag = mentionedJids.length ? `@${mentionedJids[0].split('@')[0]}` : '';
    const mentions = [senderJid, ...mentionedJids];

    // Elegir texto aleatorio
    const frasesConObjetivo = [
      `${senderTag} le aplaude con entusiasmo a ${targetTag} 👏✨`,
      `${senderTag} aplaude fuertemente a ${targetTag} 🥳👏`,
      `¡Bravo! ${senderTag} aplaude a ${targetTag} 👏🎉`,
      `${senderTag} dedica un aplauso caluroso a ${targetTag} 👏🙌`
    ];
    const frasesSolo = [
      `${senderTag} se aplaude a sí mismo con orgullo 👏✨`,
      `${senderTag} celebra con un aplauso propio 🥳👏`,
      `¡Bravo! ${senderTag} aplaude su propio logro 👏🎉`,
      `${senderTag} se da un cálido aplauso 👏🙌`
    ];
    const caption = mentionedJids.length
      ? frasesConObjetivo[Math.floor(Math.random() * frasesConObjetivo.length)]
      : frasesSolo[Math.floor(Math.random() * frasesSolo.length)];

    // Función para obtener media de una API
    const obtenerMedia = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('API no disponible');
      const json = await res.json();
      // nekos.best y waifu.pics devuelven diferentes estructuras
      if (json.results && json.results[0] && json.results[0].url) return json.results[0].url;
      if (json.url) return json.url;
      throw new Error('Respuesta inesperada de la API');
    };

    try {
      // Intentar primero con nekos.best
      let mediaUrl;
      try {
        mediaUrl = await obtenerMedia('https://nekos.best/api/v2/clap');
      } catch (_) {
        // Fallback a waifu.pics
        mediaUrl = await obtenerMedia('https://api.waifu.pics/sfw/clap');
      }

      // Enviar video o imagen según extensión
      if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('.mp4')) {
        await sock.sendMessage(jid, {
          video: { url: mediaUrl },
          gifPlayback: true,
          caption,
          mentions
        });
      } else {
        await sock.sendMessage(jid, {
          image: { url: mediaUrl },
          caption,
          mentions
        });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo procesar el comando: ' + err.message)
      });
    }
  }
};
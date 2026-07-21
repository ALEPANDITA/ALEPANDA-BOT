module.exports = {
  name: 'twitter',
  category: 'download',
  description: 'Descarga un video de Twitter/X a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'twitter ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}twitter <link>` });
    }

    try {
      const res = await fetch(`https://api.delirius.store/download/twitter?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.status || !json.data?.media?.length) {
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese tweet.' });
      }

      const info = json.data;
      const primerMedia = info.media[0];

      if (primerMedia.type !== 'video' || !primerMedia.videos?.length) {
        return sock.sendMessage(jid, { text: 'Ese tweet no tiene un video descargable.' });
      }

      const mejorCalidad = primerMedia.videos[primerMedia.videos.length - 1];

      const caption = `🐦 *Tweet de @${info.author?.username || 'desconocido'}*\n\n` +
        `${info.description || ''}\n\n` +
        `❤️ ${info.favorite || 0}  🔁 ${info.retweet || 0}  👁️ ${info.view || 0}`;

      await sock.sendMessage(jid, {
        video: { url: mejorCalidad.url },
        caption
      });
    } catch (err) {
      console.error('[twitter]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el video.' });
    }
  }
};

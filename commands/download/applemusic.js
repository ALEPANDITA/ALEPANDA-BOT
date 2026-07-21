module.exports = {
  name: 'applemusic',
  category: 'download',
  description: 'Descarga una cancion de Apple Music a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'applemusic ').length).trim();

    if (!url || !url.includes('music.apple.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}applemusic <link de apple music>` });
    }

    try {
      const res = await fetch(`https://api.delirius.store/download/applemusic?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.status || !json.data?.download) {
        return sock.sendMessage(jid, { text: 'No se pudo descargar esa cancion.' });
      }

      const info = json.data;
      const caption = `🍎 *${info.title}*\n👤 ${info.artist}\n💿 ${info.album}`;

      await sock.sendMessage(jid, {
        image: { url: info.image },
        caption
      });

      await sock.sendMessage(jid, {
        audio: { url: info.download },
        mimetype: 'audio/mp4'
      });
    } catch (err) {
      console.error('[applemusic]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar la cancion.' });
    }
  }
};

module.exports = {
  name: 'tiktok',
  category: 'download',
  description: 'Descarga un video de TikTok sin marca de agua',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'tiktok ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}tiktok <link>` });
    }

    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data?.data?.play) {
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese video.' });
      }

      const info = data.data;
      const caption = `🎵 *${info.title || 'Video de TikTok'}*\n\n` +
        `👤 Autor: ${info.author?.nickname || 'Desconocido'}\n` +
        `❤️ Likes: ${(info.digg_count || 0).toLocaleString()}\n` +
        `👁️ Vistas: ${(info.play_count || 0).toLocaleString()}\n\n` +
        `Descargando video...`;

      if (info.cover) {
        await sock.sendMessage(jid, { image: { url: info.cover }, caption });
      } else {
        await sock.sendMessage(jid, { text: caption });
      }

      await sock.sendMessage(jid, {
        video: { url: info.play },
        caption: info.title || 'Video de TikTok'
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el video.' });
    }
  }
};

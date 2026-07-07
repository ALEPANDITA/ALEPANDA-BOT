const { getApiKey } = require('../../lib/apikeys');

module.exports = {
  name: 'ig',
  category: 'download',
  description: 'Descarga un video o foto de Instagram',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'ig ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}ig <link>` });
    }

    const apiKey = getApiKey('instagram');

    try {
      let mediaUrl;

      if (apiKey) {
        const res = await fetch(`https://api.ejemplo-instagram.com/download?url=${encodeURIComponent(url)}&key=${apiKey}`);
        const data = await res.json();
        mediaUrl = data?.url;
      } else {
        const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        mediaUrl = data?.video?.[0]?.url || data?.media?.[0]?.url;
      }

      if (!mediaUrl) {
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese contenido.' });
      }

      await sock.sendMessage(jid, { video: { url: mediaUrl } });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el contenido.' });
    }
  }
};

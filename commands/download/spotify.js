const { buscarYoutube, obtenerDatosDescarga } = require('../../lib/dvyerapi');

function obtenerMetadataSpotify(url) {
  return new Promise((resolve, reject) => {
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(resolve)
      .catch(reject);
  });
}

module.exports = {
  name: 'spotify',
  category: 'download',
  description: 'Descarga el audio de una cancion a partir de un link de Spotify',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'spotify ').length).trim();

    if (!url || !url.includes('spotify.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}spotify <link de spotify>` });
    }

    let metadata;
    try {
      metadata = await obtenerMetadataSpotify(url);
    } catch (err) {
      console.error('[spotify]', err);
      return sock.sendMessage(jid, { text: 'No se pudo leer la informacion de ese link de Spotify.' });
    }

    const query = metadata.title || '';
    if (!query) {
      return sock.sendMessage(jid, { text: 'No se pudo identificar la cancion.' });
    }

    await sock.sendMessage(jid, { text: `🎵 Encontrado: *${query}*\nBuscando y descargando audio...` });

    let video;
    try {
      video = await buscarYoutube(query);
      if (!video) throw new Error('Sin resultados.');
    } catch (err) {
      console.error('[spotify]', err);
      return sock.sendMessage(jid, { text: 'No se encontro un audio equivalente para esa cancion.' });
    }

    try {
      const datos = await obtenerDatosDescarga('ytmp3', video.url);
      await sock.sendMessage(jid, {
        audio: { url: datos.remoteUrl },
        mimetype: 'audio/mp4'
      });
    } catch (err) {
      console.error('[spotify]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el audio.' });
    }
  }
};

const { buscarYoutube, obtenerDatosDescarga } = require('../../lib/dvyerapi');

module.exports = {
  name: 'spotifyalbum',
  category: 'download',
  description: 'Descarga todas las canciones de un album de Spotify a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'spotifyalbum ').length).trim();

    if (!url || !url.includes('spotify.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}spotifyalbum <link de album de spotify>` });
    }

    let album;
    try {
      const res = await fetch(`https://api.delirius.store/download/spotifyalbum?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.status || !json.tracks?.length) throw new Error('Respuesta invalida');
      album = json;
    } catch (err) {
      console.error('[spotifyalbum]', err);
      return sock.sendMessage(jid, { text: 'No se pudo leer la informacion de ese album de Spotify.' });
    }

    await sock.sendMessage(jid, {
      image: { url: album.data.image },
      caption: `💿 *${album.data.name}*\n🎵 ${album.tracks.length} canciones\n📅 ${album.data.publish}\n\nDescargando cada cancion, esto puede tardar...`
    });

    for (const track of album.tracks) {
      try {
        const query = `${track.title} ${track.artist}`;
        const video = await buscarYoutube(query);
        if (!video) throw new Error('Sin resultados en youtube');

        const datos = await obtenerDatosDescarga('ytmp3', video.url);
        await sock.sendMessage(jid, {
          audio: { url: datos.remoteUrl },
          mimetype: 'audio/mp4'
        });
      } catch (err) {
        console.error(`[spotifyalbum] fallo en "${track.title}":`, err.message);
        await sock.sendMessage(jid, { text: `⚠️ No se pudo descargar: ${track.title}` });
      }
    }

    await sock.sendMessage(jid, { text: `✅ Album completo: *${album.data.name}*` });
  }
};

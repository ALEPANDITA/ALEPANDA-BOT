module.exports = {
  name: 'hitomi',
  category: 'nsfw',
  description: 'Descarga información y detalles de Hitomi. Uso: .hitomi <link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}hitomi <link>` });
    }

    try {
      const response = await fetch(`https://api.delirius.online/anime/hitomi?url=${encodeURIComponent(url)}`);
      const json = await response.json();

      if (!json.status || !json.data) {
        return sock.sendMessage(jid, { text: 'No se pudo obtener la información de Hitomi.' });
      }

      const info = json.data;
      const tags = info.tags ? info.tags.map(t => t.tag).join(', ') : 'Ninguno';
      const artists = info.artists ? info.artists.map(a => a.artist).join(', ') : 'Desconocido';

      const mensaje = `*Título:* ${info.title}\n*ID:* ${info.id}\n*Idioma:* ${info.language_localname}\n*Publicación:* ${info.publish}\n*Artista(s):* ${artists}\n*Tags:* ${tags}\n*Total de archivos:* ${info.files ? info.files.length : 0}`;

      await sock.sendMessage(jid, { text: mensaje });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrió un error al procesar la solicitud de Hitomi.' });
    }
  }
};
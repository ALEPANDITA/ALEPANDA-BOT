const { getApiKey } = require('../../lib/apikeys');

module.exports = {
  name: 'mediafire',
  category: 'download',
  description: 'Descarga un archivo de Mediafire (ej: .mediafire <link>)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'mediafire ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}mediafire <link>` });
    }

    const apiKey = getApiKey('mediafire');

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(apiKey ? { 'x-api-key': apiKey } : {})
        }
      });
      const html = await res.text();

      const matchLink = html.match(/href="(https:\/\/download[^"]+)"/);
      const matchNombre = html.match(/class="dl-btn-label"[^>]*title="([^"]+)"/);
      const matchTamano = html.match(/\(([\d.]+\s?[KMG]B)\)/);

      if (!matchLink) {
        return sock.sendMessage(jid, { text: 'No se pudo obtener el link de descarga. Verifica que el enlace sea correcto.' });
      }

      const linkDescarga = matchLink[1];
      const nombreArchivo = matchNombre ? matchNombre[1] : 'archivo';
      const tamano = matchTamano ? matchTamano[1] : 'Desconocido';

      await sock.sendMessage(jid, {
        text: `📁 *${nombreArchivo}*\n\n📦 Tamaño: ${tamano}\n\nDescargando archivo...`
      });

      await sock.sendMessage(jid, {
        document: { url: linkDescarga },
        fileName: nombreArchivo,
        mimetype: 'application/octet-stream'
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el archivo.' });
    }
  }
};

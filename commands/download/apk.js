module.exports = {
  name: 'apk',
  category: 'download',
  description: 'Busca y descarga una app APK por su nombre',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'apk ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}apk <nombre de la app>` });
    }

    try {
      const res = await fetch(`https://api.delirius.store/download/apk?query=${encodeURIComponent(query)}`);
      const json = await res.json();

      if (!json.status || !json.data?.download) {
        return sock.sendMessage(jid, { text: 'No se encontro esa app.' });
      }

      const info = json.data;
      const tamanoMB = (info.sizeByte / (1024 * 1024)).toFixed(2);

      const caption = `📱 *${info.name}*\n` +
        `👤 Desarrollador: ${info.developer}\n` +
        `📦 Tamano: ${tamanoMB} MB\n` +
        `⬇️ Descargas: ${info.stats?.downloads || 0}\n\n` +
        `Descargando APK...`;

      await sock.sendMessage(jid, {
        image: { url: info.image },
        caption
      });

      await sock.sendMessage(jid, {
        document: { url: info.download },
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${info.name}.apk`
      });
    } catch (err) {
      console.error('[apk]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al descargar la app.' });
    }
  }
};

module.exports = {
  name: 'bypass',
  category: 'tools',
  description: 'Muestra el titulo y resumen de una pagina (bypass de bloqueos/acortadores)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'bypass ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}bypass <link>` });
    }

    try {
      const res = await fetch(`https://api.delirius.store/ia/bypass?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.status || !json.html) {
        return sock.sendMessage(jid, { text: 'No se pudo leer esa pagina.' });
      }

      const html = json.html;

      const tituloMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
        || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
      const ogImageMatch = html.match(/<meta\s+(?:name|property)=["']og:image["']\s+content=["']([^"']*)["']/i);

      const titulo = tituloMatch ? tituloMatch[1].trim() : 'Sin titulo';
      const descripcion = descMatch ? descMatch[1].trim() : 'Sin descripcion disponible';

      const caption = `🌐 *${titulo}*\n\n${descripcion}\n\n🔗 ${url}`;

      if (ogImageMatch?.[1]) {
        await sock.sendMessage(jid, { image: { url: ogImageMatch[1] }, caption });
      } else {
        await sock.sendMessage(jid, { text: caption });
      }
    } catch (err) {
      console.error('[bypass]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al leer esa pagina.' });
    }
  }
};

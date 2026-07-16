module.exports = {
  name: 'wikipedia',
  category: 'tools',
  description: 'Busca un resumen en Wikipedia',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const busqueda = texto.slice((prefix + 'wikipedia ').length).trim();

    if (!busqueda) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}wikipedia <tema>` }, { quoted: msg });
    }

    try {
      const res = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(busqueda)}`);
      const data = await res.json();

      if (!data.extract) {
        return sock.sendMessage(jid, { text: 'No encontre ningun articulo con ese nombre.' }, { quoted: msg });
      }

      const textoFinal = `📖 *${data.title}*\n\n${data.extract}\n\n🔗 ${data.content_urls?.desktop?.page || ''}`;

      if (data.thumbnail?.source) {
        await sock.sendMessage(jid, { image: { url: data.thumbnail.source }, caption: textoFinal }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error buscando en Wikipedia.' }, { quoted: msg });
    }
  }
};

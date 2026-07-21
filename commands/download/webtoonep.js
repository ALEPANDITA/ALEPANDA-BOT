function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  name: 'webtoonep',
  category: 'download',
  description: 'Descarga todas las paginas de un episodio de Webtoons a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'webtoonep ').length).trim();

    if (!url || !url.includes('webtoons.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}webtoonep <link del capitulo de webtoons>` });
    }

    let paginas;
    try {
      const res = await fetch(`https://api.delirius.store/download/wbdl?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.status || !json.data?.length) throw new Error('Respuesta invalida');
      paginas = json.data;
    } catch (err) {
      console.error('[webtoonep]', err);
      return sock.sendMessage(jid, { text: 'No se pudo leer ese capitulo.' });
    }

    await sock.sendMessage(jid, { text: `📖 Enviando ${paginas.length} paginas, esto puede tardar un rato...` });

    for (let i = 0; i < paginas.length; i++) {
      try {
        await sock.sendMessage(jid, { image: { url: paginas[i] } });
      } catch (err) {
        console.error(`[webtoonep] fallo pagina ${i + 1}:`, err.message);
      }
      await esperar(600);
    }

    await sock.sendMessage(jid, { text: `✅ Capitulo completo (${paginas.length} paginas)` });
  }
};

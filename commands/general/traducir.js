module.exports = {
  name: 'traducir',
  category: 'general',
  description: 'Traduce texto. Uso: .traducir en|es <texto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = (texto || '').trim().split(/\s+/);
    const idiomas = (partes[1] || '').toLowerCase();
    const textoTraducir = partes.slice(2).join(' ');

    if (!idiomas.includes('|') || !textoTraducir) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}traducir origen|destino <texto>\nEjemplo: ${prefix}traducir es|en Hola como estas` });
    }

    const [origen, destino] = idiomas.split('|');

    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textoTraducir)}&langpair=${origen}|${destino}`
      );
      const data = await res.json();
      const traduccion = data?.responseData?.translatedText;

      if (!traduccion) {
        return sock.sendMessage(jid, { text: 'No se pudo traducir el texto.' });
      }

      await sock.sendMessage(jid, {
        text: `🌐 *TRADUCCION* (${origen} → ${destino})\n\n${traduccion}`
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al traducir.' });
    }
  }
};

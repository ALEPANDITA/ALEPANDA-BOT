module.exports = {
  name: 'meme',
  category: 'fun',
  description: 'Envia un meme random',
  execute: async (sock, jid) => {
    try {
      const res = await fetch('https://meme-api.com/gimme');
      const data = await res.json();
      await sock.sendMessage(jid, {
        image: { url: data.url },
        caption: data.title || 'Meme random'
      });
    } catch (err) {
      await sock.sendMessage(jid, { text: 'No se pudo obtener un meme, intenta de nuevo.' });
    }
  }
};

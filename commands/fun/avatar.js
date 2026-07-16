const fetch = require('node-fetch');
module.exports = {
  name: 'avatar',
  aliases: ['ava'],
  category: 'fun',
  description: 'Avatar aleatorio de anime (Delirius)',
  execute: async (sock, jid) => {
    try {
      const res = await fetch('https://api.delirius.store/anime/avatar');
      if (!res.ok) throw new Error(`API respondió con ${res.status}`);
      const data = await res.json();
      if (!data?.url) throw new Error("No se recibió una URL válida");
      await sock.sendMessage(jid, { image: { url: data.url }, caption: 'Avatar aleatorio de anime' });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
    }
  }
};

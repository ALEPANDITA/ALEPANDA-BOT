const fetch = require('node-fetch');
module.exports = {
  name: 'ttp',
  aliases: ['text'],
  category: 'fun',
  description: 'Convierte texto a estilo TikTok',
  execute: async (sock, jid, msg, { texto }) => {
    const args = texto.split(' ').slice(1);
    const text = args.join(' ') || 'Hola';
    try {
      const res = await fetch(`https://api.delirius.store/canvas/ttp?text=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error(`API respondió con ${res.status}`);
      const data = await res.json();
      if (!data?.url) throw new Error("No se recibió una URL válida");
      await sock.sendMessage(jid, { image: { url: data.url }, caption: `Texto: ${text}` });
    } catch (err) {
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` });
    }
  }
};

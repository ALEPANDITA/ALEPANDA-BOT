const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'hentai',
  category: 'nsfw',
  description: 'Envia una imagen hentai aleatoria. Uso: .hentai',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    try {
      const res = await fetch('https://api.evogb.org/nsfw/random/hentai');
      if (!res.ok) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo conectar a la API de hentai.') });
      }
      const data = await res.json();
      if (!data.status) {
        return sock.sendMessage(jid, { text: cajaError('No se encontró contenido hentai.') });
      }
      if (!data.data || !data.data.url) {
        return sock.sendMessage(jid, { text: cajaError('La API de hentai no proporcionó una URL válida.') });
      }
      await sock.sendMessage(jid, { image: { url: data.data.url } });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al descargar la imagen hentai: ' + err.message) });
    }
  }
};
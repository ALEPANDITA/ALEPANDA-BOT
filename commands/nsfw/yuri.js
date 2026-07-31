const { caja } = require('../../lib/estilo');

module.exports = {
  name: 'yuri',
  category: 'nsfw',
  description: 'Imagen aleatoria de yuri',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      const res = await fetch('https://api.evogb.org/nsfw/random/yuri2');
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (!json.status) {
        throw new Error('API returned error');
      }
      const { url, type, mime } = json.data;
      await sock.sendMessage(jid, { image: { url: url }, caption: 'Uff, pa eso está re bueno' });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: caja(`Ocurrio un error al obtener la imagen: ${err.message}`, { titulo: 'ERROR' }) });
    }
  }
};
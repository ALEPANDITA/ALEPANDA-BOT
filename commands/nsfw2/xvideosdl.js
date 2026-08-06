const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'xvideosdl',
  aliases: ['xvd'],
  category: 'nsfw2',
  description: 'Descarga un video de Xvideos. Uso: .xvideosdl <link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!url) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}xvideosdl <link>`, { titulo: 'FALTA INFORMACION' }) });
    }
    try {
      const response = await fetch(`https://api.delirius.online/download/xvideos?url=${encodeURIComponent(url)}`);
      const json = await response.json();
      
      if (!json.status || !json.data || !json.data.download) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener el video de la API.') });
      }

      const videoData = json.data;
      const caption = `*Título:* ${videoData.title}\n*Duración:* ${videoData.duration}\n*Vistas:* ${videoData.views}`;

      await sock.sendMessage(jid, {
        video: { url: videoData.download },
        caption: caption
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la descarga.') });
    }
  }
};
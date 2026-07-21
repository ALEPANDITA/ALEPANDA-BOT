const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'ytmp3v2',
  category: 'download',
  description: 'Descarga el audio MP3 de un video de YouTube a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'ytmp3v2 ').length).trim();

    if (!url || !/youtu\.?be/.test(url)) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}ytmp3v2 <link de youtube>`, { titulo: 'FALTA INFORMACION' })
      });
    }

    await sock.sendMessage(jid, {
      text: cargando('Descargando audio...', { titulo: 'YTMP3 V2' })
    });

    try {
      const res = await fetch(`https://api.delirius.store/download/ytmp3v2?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.success || !json.data?.download) {
        throw new Error('Respuesta invalida de la API');
      }

      const { title, download, image } = json.data;

      await sock.sendMessage(jid, {
        audio: { url: download },
        mimetype: 'audio/mpeg',
        fileName: `${title || 'audio'}.mp3`
      }, { quoted: msg });
    } catch (err) {
      console.error('[ytmp3v2]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo descargar el audio de ese link.') });
    }
  }
};

const fs = require('fs');
const { obtenerDatosGenerico, descargarArchivo } = require('../../lib/dvyerapi');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'facebook',
  aliases: ['fb'],
  category: 'download',
  description: 'Descarga un video de Facebook. Uso: .facebook <link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.trim().split(/\s+/)[1];

    if (!url || !url.startsWith('http')) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}facebook <link del video>`, { titulo: 'FACEBOOK' }) });
    }

    await sock.sendMessage(jid, { text: cargando('Descargando video de Facebook...', { titulo: 'FACEBOOK' }) });

    let tempPath;
    try {
      const datos = await obtenerDatosGenerico('facebook', url);
      tempPath = await descargarArchivo(datos.remoteUrl, datos.tipo === 'video' ? 'mp4' : 'jpg');

      const buffer = fs.readFileSync(tempPath);
      if (datos.tipo === 'video') {
        await sock.sendMessage(jid, { video: buffer, caption: datos.titulo || '' });
      } else {
        await sock.sendMessage(jid, { image: buffer, caption: datos.titulo || '' });
      }
    } catch (err) {
      console.error(err);
      const mensaje = err.code === 'NO_API_KEY' ? err.message : `No se pudo descargar: ${err.message}`;
      await sock.sendMessage(jid, { text: cajaError(mensaje) });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

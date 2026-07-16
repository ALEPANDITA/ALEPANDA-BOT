const fs = require('fs');
const { resolverEntrada, obtenerDatosDescarga, descargarArchivo, limpiarTexto } = require('../../lib/dvyerapi');
const { obtenerBusqueda } = require('../../lib/busquedas');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'ytmp4',
  aliases: ['ytv', 'ytvideo'],
  category: 'download',
  description: 'Descarga video MP4 de YouTube. Uso: .ytmp4 <link, nombre, o numero de .ytsearch>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = limpiarTexto(texto.trim().split(/\s+/).slice(1).join(' '));

    if (!input) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}ytmp4 <link, nombre del video, o numero de ${prefix}ytsearch>`, { titulo: 'FALTA INFORMACION' })
      });
    }

    let tempPath;
    try {
      let resuelto;

      if (/^\d+$/.test(input)) {
        const deLaBusqueda = obtenerBusqueda(jid, input);
        if (!deLaBusqueda) {
          return sock.sendMessage(jid, {
            text: advertencia(`No hay una busqueda reciente con ese numero. Usa ${prefix}ytsearch primero.`, { titulo: 'SIN RESULTADOS' })
          });
        }
        resuelto = deLaBusqueda;
      } else {
        resuelto = await resolverEntrada(input);
      }

      if (!resuelto?.url) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo identificar un video.') });
      }

      await sock.sendMessage(jid, {
        text: cargando(`Descargando video de: *${resuelto.title || input}*`, { titulo: 'YTMP4' })
      });

      const datos = await obtenerDatosDescarga('ytmp4', resuelto.url);
      tempPath = await descargarArchivo(datos.remoteUrl, 'mp4');

      const buffer = fs.readFileSync(tempPath);
      const titulo = datos.title || resuelto.title || 'YouTube video';

      await sock.sendMessage(jid, {
        video: buffer,
        caption: titulo,
        fileName: `${titulo}.mp4`
      });
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : `No se pudo descargar el video: ${err.message}`;
      await sock.sendMessage(jid, { text: cajaError(textoError) });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

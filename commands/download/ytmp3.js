const fs = require('fs');
const { resolverEntrada, obtenerDatosDescarga, descargarArchivo, limpiarTexto } = require('../../lib/dvyerapi');
const { obtenerBusqueda } = require('../../lib/busquedas');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'ytmp3',
  aliases: ['yta', 'ytaudio'],
  category: 'download',
  description: 'Descarga audio M4A de YouTube. Uso: .ytmp3 <link, nombre, o numero de .ytsearch>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = limpiarTexto(texto.trim().split(/\s+/).slice(1).join(' '));

    if (!input) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}ytmp3 <link, nombre de la cancion, o numero de ${prefix}ytsearch>`, { titulo: 'FALTA INFORMACION' })
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
        text: cargando(`Descargando audio de: *${resuelto.title || input}*`, { titulo: 'YTMP3' })
      });

      const datos = await obtenerDatosDescarga('ytmp3', resuelto.url);
      tempPath = await descargarArchivo(datos.remoteUrl, 'm4a');

      const buffer = fs.readFileSync(tempPath);
      const titulo = datos.title || resuelto.title || 'YouTube M4A';

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: 'audio/mp4',
        fileName: `${titulo}.m4a`
      });
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : `No se pudo descargar el audio: ${err.message}`;
      await sock.sendMessage(jid, { text: cajaError(textoError) });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

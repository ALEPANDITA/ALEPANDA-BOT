const { resolverEntrada, obtenerDatosDescarga, descargarBuffer, limpiarTexto } = require('../../../lib/dvyerapi');
const { obtenerBusqueda } = require('../../../lib/busquedas');
const { cargando, advertencia, error: cajaError } = require('../../../lib/estilo');

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

      const vieneDeBoton = !!msg.message?.templateButtonReplyMessage;
      if (!vieneDeBoton) {
        await sock.sendMessage(jid, {
          text: cargando(`Descargando audio de: *${resuelto.title || input}*`, { titulo: 'YTMP3' })
        });
      }

      const datos = await obtenerDatosDescarga('ytmp3', resuelto.url);
      const buffer = await descargarBuffer(datos.remoteUrl);
      const titulo = datos.title || resuelto.title || 'YouTube M4A';

      await sock.sendMessage(jid, {
        audio: buffer,
        // El archivo que entrega la API de descarga es MP3 real (confirmado con
        // ffprobe: 'Input #0, mp3'), aunque antes se etiquetaba como audio/mp4/.m4a.
        // Android ignora la etiqueta y lo reproduce igual; iPhone SI confia en la
        // etiqueta declarada y fallaba al recibir MP3 disfrazado de MP4. Aqui solo
        // se corrige la etiqueta para que diga la verdad -- el audio en si NO se
        // vuelve a codificar (eso fue lo que rompio las cosas la vez anterior).
        mimetype: 'audio/mpeg',
        fileName: `${titulo}.mp3`
      });
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : `No se pudo descargar el audio: ${err.message}`;
      await sock.sendMessage(jid, { text: cajaError(textoError) });
    }
  }
};

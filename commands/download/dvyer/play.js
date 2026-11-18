const fs = require('fs');
const { obtenerDatosDescarga, descargarArchivo, buscarYoutube, limpiarTexto } = require('../../../lib/dvyerapi');
const ytd = require('../../../lib/ytdirecto');
const waCache = require('../../../lib/wa-media-cache');

function formatearDuracion(segundos = 0) {
  const sec = Number(segundos) || 0;
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

function formatearVistas(valor = 0) {
  const n = Number(valor) || 0;
  if (n <= 0) return 'Sin datos';
  return new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}


module.exports = {
  name: 'play',
  category: 'download',
  description: 'Busca en YouTube y manda el audio. Uso: .play <busqueda> [video]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/).slice(1);
    const quiereVideo = partes[partes.length - 1]?.toLowerCase() === 'video';
    if (quiereVideo) partes.pop();

    const query = limpiarTexto(partes.join(' '));

    if (!query) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}play <busqueda>\nAgrega "video" al final para descargar video en vez de audio.\nEjemplo: ${prefix}play bad bunny\nEjemplo: ${prefix}play bad bunny video`
      });
    }

    await sock.sendMessage(jid, { text: `🔎 Buscando *${query}*...` });

    let video;
    try {
      video = await buscarYoutube(query);
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : 'Ocurrio un error al buscar en YouTube.';
      return sock.sendMessage(jid, { text: textoError });
    }

    if (!video) {
      return sock.sendMessage(jid, { text: 'No encontre resultados para esa busqueda.' });
    }

    const ficha = `🐼 *ALEPANDA PLAY*\n\n` +
      `🎵 *${video.title}*\n` +
      `👤 Canal: ${video.author || 'Desconocido'}\n` +
      `⏱️ Duracion: ${formatearDuracion(video.duration)}\n` +
      `👁️ Vistas: ${formatearVistas(video.views)}\n\n` +
      `⬇️ Descargando ${quiereVideo ? 'video' : 'audio'}...`;

    // La ficha se manda mientras ya se va preparando la descarga (antes se esperaba
    // a que la ficha terminara para empezar). El audio igual sale DESPUES de la ficha.
    const fichaP = sock.sendMessage(jid, {
      image: { url: video.thumbnail },
      caption: ficha
    }).catch(() => sock.sendMessage(jid, { text: ficha }));
    fichaP.catch(() => {}); // evita "unhandled rejection" si falla mientras se descarga
    const esperarFicha = () => fichaP.catch((e) => console.error('[play] no se pudo mandar la ficha:', e.message));

    const idVideo = ytd.idDeUrl(video.url);

    let tempPath;
    try {
      const endpoint = quiereVideo ? 'ytmp4' : 'ytmp3';

      // Cancion ya enviada antes: se reenvia con el recibo de WhatsApp (sin leer ni subir el mp3)
      if (!quiereVideo && waCache.leer(idVideo)) {
        await esperarFicha();
        if (await waCache.reenviar(sock, jid, idVideo)) return;
      }

      const datosP = obtenerDatosDescarga(endpoint, video.url);
      datosP.catch(() => {});
      await esperarFicha();
      const datos = await datosP;
      tempPath = await descargarArchivo(datos.remoteUrl, quiereVideo ? 'mp4' : 'mp3');

      const titulo = datos.title || video.title;
      const buffer = fs.readFileSync(tempPath);

      if (quiereVideo) {
        await sock.sendMessage(jid, { video: buffer, caption: titulo });
      } else {
        // Se manda el audio tal cual (sin pasarlo por ffmpeg), igual que
        // .ytmp3 -- confirmado que asi se reproduce bien tanto en Android
        // como en iPhone. Un intento anterior de convertir a OGG/Opus para
        // "mejorar" la compatibilidad resulto ser lo que danaba el audio.
        const enviado = await sock.sendMessage(jid, {
          audio: buffer,
          // Ver nota igual en ytmp3.js: el archivo real es MP3, se etiquetaba mal
          // como audio/mp4/.m4a. Android ignoraba la etiqueta y reproducia bien;
          // iPhone confiaba en ella y fallaba. Solo se corrige la etiqueta, no se re-codifica.
          mimetype: 'audio/mpeg',
          fileName: `${titulo}.mp3`
        });
        waCache.guardar(idVideo, enviado); // para reenviarla al instante la proxima vez
      }
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : `No se pudo descargar: ${err.message}`;
      await sock.sendMessage(jid, { text: textoError });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

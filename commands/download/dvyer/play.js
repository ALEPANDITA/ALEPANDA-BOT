const fs = require('fs');
const { obtenerDatosDescarga, descargarArchivo, buscarYoutube, limpiarTexto } = require('../../../lib/dvyerapi');
const ytd = require('../../../lib/ytdirecto');
const waCache = require('../../../lib/wa-media-cache');
const { crearGifPlay } = require('../../../lib/playgif');

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

    const T = { ini: Date.now() }; // PARCHE-PLAY-TIEMPOS
    // El aviso de "Buscando" ya no frena la busqueda: salen al mismo tiempo (la ficha espera a que el aviso haya salido)
    const buscandoP = sock.sendMessage(jid, { text: `🔎 Buscando *${query}*...` }).catch(() => {});

    let video;
    try {
      video = await buscarYoutube(query);
      T.busca = Date.now();
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
    // La ficha sale como GIF animado (marco de reproductor con la portada adentro, lib/playgif.js).
    // Si falta el marco (assets/play) o algo falla, sale la imagen de siempre, y si eso falla, solo el texto.
    const fichaP = (async () => {
      await buscandoP;
      const gif = video.thumbnail
        ? await crearGifPlay({ portada: video.thumbnail, clave: ytd.idDeUrl(video.url) || video.url }).catch(() => null)
        : null;
      if (gif) {
        try { return await sock.sendMessage(jid, { video: gif, gifPlayback: true, mimetype: 'video/mp4', caption: ficha }); }
        catch (err) { console.error('[play] no se pudo mandar el GIF:', err.message); }
      }
      return sock.sendMessage(jid, { image: { url: video.thumbnail }, caption: ficha });
    })().catch(() => sock.sendMessage(jid, { text: ficha }));
    fichaP.catch(() => {}); // evita "unhandled rejection" si falla mientras se descarga
    fichaP.then(() => { T.ficha = Date.now(); }, () => {});
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

      T.datosIni = Date.now();
      const datosP = obtenerDatosDescarga(endpoint, video.url);
      datosP.catch(() => {});
      datosP.then(() => { T.datos = Date.now(); }, () => {});
      await esperarFicha();
      const datos = await datosP;
      tempPath = await descargarArchivo(datos.remoteUrl, quiereVideo ? 'mp4' : 'mp3');
      T.listo = Date.now();

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
      try {
        const seg = (a, b) => (a && b ? ((b - a) / 1000).toFixed(1) + 's' : '-');
        console.log(`[play] tiempos -> buscar ${seg(T.ini, T.busca)} | gif+envio ficha ${seg(T.busca, T.ficha)} | descarga yt-dlp ${seg(T.datosIni, T.datos)} | subir audio ${seg(T.listo, Date.now())} | TOTAL ${seg(T.ini, Date.now())}`);
      } catch (_) { /* solo diagnostico */ }
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const { obtenerDatosDescarga, descargarArchivo, buscarYoutube, limpiarTexto } = require('../../../lib/dvyerapi');

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

// Convierte cualquier audio a OGG/Opus mono, que es el formato que WhatsApp
// reproduce de forma confiable en TODOS los dispositivos. El archivo original
// (m4a/mp4) se reproduce bien en Android pero falla en iPhone con el error
// "No se pudo descargar el audio" -- este es un problema conocido y documentado
// de WhatsApp/Baileys, no un bug del bot en si.
async function convertirAOgg(rutaEntrada) {
  const rutaSalida = path.join(os.tmpdir(), `play-${Date.now()}.ogg`);
  await execFileAsync('ffmpeg', [
    '-i', rutaEntrada,
    '-avoid_negative_ts', 'make_zero',
    '-ac', '1',
    '-c:a', 'libopus',
    '-b:a', '64k',
    rutaSalida
  ]);
  return rutaSalida;
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

    await sock.sendMessage(jid, {
      image: { url: video.thumbnail },
      caption: ficha
    }).catch(() => sock.sendMessage(jid, { text: ficha }));

    let tempPath;
    let tempOgg;
    try {
      const endpoint = quiereVideo ? 'ytmp4' : 'ytmp3';
      const datos = await obtenerDatosDescarga(endpoint, video.url);
      tempPath = await descargarArchivo(datos.remoteUrl, quiereVideo ? 'mp4' : 'm4a');

      const titulo = datos.title || video.title;

      if (quiereVideo) {
        const buffer = fs.readFileSync(tempPath);
        await sock.sendMessage(jid, { video: buffer, caption: titulo });
      } else {
        tempOgg = await convertirAOgg(tempPath);
        const buffer = fs.readFileSync(tempOgg);
        await sock.sendMessage(jid, {
          audio: buffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: false
        });
      }
    } catch (err) {
      console.error(err);
      const textoError = err.code === 'NO_API_KEY'
        ? err.message
        : `No se pudo descargar: ${err.message}`;
      await sock.sendMessage(jid, { text: textoError });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (tempOgg && fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
    }
  }
};

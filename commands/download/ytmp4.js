const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function obtenerInfo(query) {
  return new Promise((resolve, reject) => {
    const busqueda = query.startsWith('http') ? query : `ytsearch1:${query}`;
    const comando = `yt-dlp --dump-json --extractor-args "youtube:player_client=android" "${busqueda}"`;
    exec(comando, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) return reject(error);
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function formatearDuracion(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = Math.floor(segundos % 60);
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

module.exports = {
  name: 'ytmp4',
  category: 'download',
  description: 'Descarga un video de YouTube',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'ytmp4 ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}ytmp4 <nombre o link>` });
    }

    let info;
    try {
      info = await obtenerInfo(query);
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: 'No se encontro ese video.' });
    }

    const caption = `🎬 *${info.title}*\n\n` +
      `👤 Canal: ${info.uploader || 'Desconocido'}\n` +
      `⏱️ Duracion: ${formatearDuracion(info.duration || 0)}\n` +
      `👁️ Vistas: ${(info.view_count || 0).toLocaleString()}\n\n` +
      `Descargando video...`;

    if (info.thumbnail) {
      await sock.sendMessage(jid, { image: { url: info.thumbnail }, caption });
    } else {
      await sock.sendMessage(jid, { text: caption });
    }

    const outputPath = path.join(os.tmpdir(), `ytmp4_${Date.now()}.mp4`);
    const comando = `yt-dlp --extractor-args "youtube:player_client=android" -f "bestvideo[vcodec^=avc1][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]" --merge-output-format mp4 --postprocessor-args "-movflags +faststart" -o "${outputPath}" "${info.webpage_url}"`;

    exec(comando, async (error) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el video.' });
      }

      try {
        const buffer = fs.readFileSync(outputPath);
        await sock.sendMessage(jid, { video: buffer, caption: info.title });
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo enviar el video descargado.' });
      }
    });
  }
};

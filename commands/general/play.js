const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function obtenerInfo(query) {
  return new Promise((resolve, reject) => {
    const comando = `yt-dlp --dump-json --extractor-args "youtube:player_client=android" "ytsearch1:${query}"`;
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
  name: 'play',
  category: 'general',
  description: 'Busca y descarga un audio de YouTube',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.slice((prefix + 'play ').length).trim();

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}play <nombre de la cancion>` });
    }

    let info;
    try {
      info = await obtenerInfo(query);
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: 'No se encontro esa cancion.' });
    }

    const caption = `🎵 *${info.title}*\n\n` +
      `👤 Canal: ${info.uploader || 'Desconocido'}\n` +
      `⏱️ Duracion: ${formatearDuracion(info.duration || 0)}\n` +
      `👁️ Vistas: ${(info.view_count || 0).toLocaleString()}\n\n` +
      `Descargando audio...`;

    if (info.thumbnail) {
      await sock.sendMessage(jid, { image: { url: info.thumbnail }, caption });
    } else {
      await sock.sendMessage(jid, { text: caption });
    }

    const outputPath = path.join(os.tmpdir(), `play_${Date.now()}.m4a`);
    const comando = `yt-dlp -x --audio-format m4a --extractor-args "youtube:player_client=android" -o "${outputPath}" "${info.webpage_url}"`;

    exec(comando, async (error) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'Ocurrio un error al descargar el audio.' });
      }

      try {
        const buffer = fs.readFileSync(outputPath);
        await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4' });
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo enviar el audio descargado.' });
      }
    });
  }
};

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function obtenerInfo(url) {
  return new Promise((resolve, reject) => {
    const comando = `yt-dlp --dump-json "${url}"`;
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

module.exports = {
  name: 'facebook',
  category: 'download',
  description: 'Descarga un video de Facebook (ej: .facebook <link>)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'facebook ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}facebook <link>` });
    }

    let info;
    try {
      info = await obtenerInfo(url);
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: 'No se pudo obtener informacion de ese video.' });
    }

    const caption = `📘 *${info.title || 'Video de Facebook'}*\n\n` +
      `👤 Autor: ${info.uploader || 'Desconocido'}\n` +
      `⏱️ Duracion: ${info.duration ? Math.floor(info.duration / 60) + ':' + String(Math.floor(info.duration % 60)).padStart(2, '0') : 'Desconocida'}\n` +
      `👁️ Vistas: ${(info.view_count || 0).toLocaleString()}\n\n` +
      `Descargando video...`;

    if (info.thumbnail) {
      await sock.sendMessage(jid, { image: { url: info.thumbnail }, caption });
    } else {
      await sock.sendMessage(jid, { text: caption });
    }

    const outputPath = path.join(os.tmpdir(), `fb_${Date.now()}.mp4`);
    const comando = `yt-dlp -f "best[ext=mp4]" -o "${outputPath}" "${url}"`;

    exec(comando, async (error) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese video de Facebook.' });
      }

      try {
        const buffer = fs.readFileSync(outputPath);
        await sock.sendMessage(jid, { video: buffer });
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo enviar el video descargado.' });
      }
    });
  }
};

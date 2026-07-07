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
  name: 'pinterest',
  category: 'download',
  description: 'Descarga un video o imagen de Pinterest (ej: .pinterest <link>)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'pinterest ').length).trim();

    if (!url) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}pinterest <link>` });
    }

    let info;
    try {
      info = await obtenerInfo(url);
    } catch (err) {
      // Si yt-dlp falla, puede ser una imagen (no video); intentamos scraping directo
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const match = html.match(/<meta property="og:image" content="([^"]+)"/);
        const matchTitulo = html.match(/<meta property="og:title" content="([^"]+)"/);

        if (!match) {
          return sock.sendMessage(jid, { text: 'No se pudo descargar ese pin.' });
        }

        const caption = `📌 *${matchTitulo ? matchTitulo[1] : 'Pin de Pinterest'}*\n\nDescargando imagen...`;
        await sock.sendMessage(jid, { image: { url: match[1] }, caption });
        return;
      } catch (err2) {
        console.error(err2);
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese pin.' });
      }
    }

    const caption = `📌 *${info.title || 'Video de Pinterest'}*\n\n` +
      `⏱️ Duracion: ${info.duration ? Math.floor(info.duration) + 's' : 'Desconocida'}\n\n` +
      `Descargando video...`;

    if (info.thumbnail) {
      await sock.sendMessage(jid, { image: { url: info.thumbnail }, caption });
    } else {
      await sock.sendMessage(jid, { text: caption });
    }

    const outputPath = path.join(os.tmpdir(), `pin_${Date.now()}.mp4`);
    const comando = `yt-dlp -f "best[ext=mp4]" -o "${outputPath}" "${url}"`;

    exec(comando, async (error) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'No se pudo descargar ese video de Pinterest.' });
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

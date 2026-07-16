const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const coloresNeon = ['#ff00ff', '#00ffff', '#39ff14', '#ff073a', '#faed27'];

function escaparTexto(t) {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\u2019")
    .replace(/%/g, '\\%');
}

module.exports = {
  name: 'stickerneon',
  aliases: ['s2'],
  category: 'fun',
  description: 'Crea un sticker con texto estilo neon. Uso: .s2 <texto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const contenido = partes.slice(1).join(' ').trim();

    if (!contenido) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}s2 <texto>` });
    }

    const color = coloresNeon[Math.floor(Math.random() * coloresNeon.length)];
    const escapado = escaparTexto(contenido.toUpperCase());

    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `neon_${Date.now()}.webp`);

    // Capas: texto borroso de color (glow) debajo, texto blanco nitido encima.
    const filtro =
      `color=c=black@0.0:s=512x512,format=rgba[bg];` +
      `[bg]drawtext=text='${escapado}':fontcolor=${color}:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2:font=Sans-Bold,` +
      `gblur=sigma=8[glow];` +
      `[glow]drawtext=text='${escapado}':fontcolor=${color}:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2:font=Sans-Bold[glow2];` +
      `[glow2]drawtext=text='${escapado}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2:font=Sans-Bold`;

    const comando = `ffmpeg -f lavfi -i "${filtro}" -frames:v 1 -c:v libwebp -lossless 0 -q:v 80 -y "${outputPath}"`;

    exec(comando, async (error) => {
      if (error) {
        console.error(error);
        return sock.sendMessage(jid, { text: 'No se pudo crear el sticker neon.' });
      }

      try {
        const buffer = fs.readFileSync(outputPath);
        await sock.sendMessage(jid, { sticker: buffer });
        fs.unlinkSync(outputPath);
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: 'No se pudo enviar el sticker neon.' });
      }
    });
  }
};

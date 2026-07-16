const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'emojimix',
  category: 'fun',
  description: 'Combina dos emojis en un sticker. Ej: .emojimix 😀+😭',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const contenido = partes.slice(1).join(' ').trim();
    const [emoji1, emoji2] = contenido.split('+').map(e => (e || '').trim());

    if (!emoji1 || !emoji2) {
      return sock.sendMessage(jid, {
        text: advertencia(`Ingresa 2 emojis separados por "+".\nEjemplo: ${prefix}emojimix 😀+😭`, { titulo: 'FALTAN EMOJIS', estilo: 'kawaii' })
      });
    }

    try {
      const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
      const res = await (await fetch(url)).json();

      if (!res.results || res.results.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontro una combinacion para esos emojis.') });
      }

      const imagenUrl = res.results[0].url;
      const buffer = Buffer.from(await (await fetch(imagenUrl)).arrayBuffer());

      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `emojimix_in_${Date.now()}.png`);
      const outputPath = path.join(tmpDir, `emojimix_out_${Date.now()}.webp`);
      fs.writeFileSync(inputPath, buffer);

      const { exec } = require('child_process');
      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -q:v 75 -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, (error) => (error ? reject(error) : resolve()));
      });

      const webpBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { sticker: webpBuffer });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el sticker de emojis.') });
    }
  }
};

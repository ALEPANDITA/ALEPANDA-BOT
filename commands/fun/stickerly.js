const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');
const { obtenerBusquedaStickerly } = require('../../lib/busquedasStickerly');

function convertirAWebp(buffer) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputPath = path.join(os.tmpdir(), `stickerly_in_${id}.png`);
    const outputPath = path.join(os.tmpdir(), `stickerly_out_${id}.webp`);

    fs.writeFileSync(inputPath, buffer);

    const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -q:v 75 -y "${outputPath}"`;

    exec(comando, (error) => {
      fs.unlink(inputPath, () => {});
      if (error) return reject(error);
      try {
        const webpBuffer = fs.readFileSync(outputPath);
        fs.unlink(outputPath, () => {});
        resolve(webpBuffer);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  name: 'stickerly',
  category: 'fun',
  description: 'Descarga todos los stickers de un pack de sticker.ly a partir de su link',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const entrada = texto.slice((prefix + 'stickerly ').length).trim();

    if (!entrada) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}stickerly <link de sticker.ly o numero de ${prefix}stickerlysearch>`, { titulo: 'STICKERLY' })
      });
    }

    let url;
    if (/^\d+$/.test(entrada)) {
      const delaBusqueda = obtenerBusquedaStickerly(jid, entrada);
      if (!delaBusqueda) {
        return sock.sendMessage(jid, {
          text: advertencia(`No hay una busqueda reciente con ese numero. Usa ${prefix}stickerlysearch primero.`, { titulo: 'SIN RESULTADOS' })
        });
      }
      url = delaBusqueda.url;
    } else if (entrada.includes('sticker.ly')) {
      url = entrada;
    } else {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}stickerly <link de sticker.ly o numero de ${prefix}stickerlysearch>`, { titulo: 'STICKERLY' })
      });
    }

    let pack;
    try {
      const res = await fetch(`https://api.delirius.store/download/stickerly?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.status || !json.data?.stickers?.length) throw new Error('Respuesta invalida');
      pack = json.data;
    } catch (err) {
      console.error('[stickerly]', err);
      return sock.sendMessage(jid, { text: cajaError('No se pudo leer ese pack de sticker.ly.') });
    }

    await sock.sendMessage(jid, {
      text: cargando(`Pack: *${pack.name}*\n👤 ${pack.author}\n🖼️ ${pack.stickers.length} stickers\n\nEnviando cada uno...`, { titulo: 'STICKERLY' })
    });

    for (const stickerUrl of pack.stickers) {
      try {
        const res = await fetch(stickerUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const webpBuffer = await convertirAWebp(buffer);
        await sock.sendMessage(jid, { sticker: webpBuffer });
      } catch (err) {
        console.error('[stickerly] fallo un sticker:', err.message);
      }
    }
  }
};

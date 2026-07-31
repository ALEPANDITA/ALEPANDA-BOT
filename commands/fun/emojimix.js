const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { advertencia, error: cajaError } = require('../../lib/estilo');

const METADATA_URL = 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json';
let metadataCache = null;

async function obtenerMetadata() {
  if (metadataCache) return metadataCache;
  console.log('[emojimix] Descargando base de datos de Emoji Kitchen (solo la primera vez)...');
  const res = await fetch(METADATA_URL);
  if (!res.ok) throw new Error(`No se pudo descargar la base de emojis (HTTP ${res.status})`);
  metadataCache = await res.json();
  console.log('[emojimix] Base de datos cargada.');
  return metadataCache;
}

function emojiACodepoint(emoji) {
  return Array.from(emoji)
    .map(c => c.codePointAt(0))
    .filter(cp => cp !== 0xFE0F)
    .map(cp => cp.toString(16))
    .join('-');
}

async function buscarCombinacion(emoji1, emoji2) {
  const metadata = await obtenerMetadata();
  const cp1 = emojiACodepoint(emoji1);
  const cp2 = emojiACodepoint(emoji2);

  const combosDirecto = metadata.data[cp1]?.combinations?.[cp2];
  if (combosDirecto?.length) {
    return combosDirecto.find(c => c.isLatest) || combosDirecto[0];
  }

  const combosInverso = metadata.data[cp2]?.combinations?.[cp1];
  if (combosInverso?.length) {
    return combosInverso.find(c => c.isLatest) || combosInverso[0];
  }

  return null;
}

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
      const combinacion = await buscarCombinacion(emoji1, emoji2);

      if (!combinacion) {
        return sock.sendMessage(jid, { text: cajaError('Esos dos emojis no tienen combinacion en Emoji Kitchen.') });
      }

      const buffer = Buffer.from(await (await fetch(combinacion.gStaticUrl)).arrayBuffer());

      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `emojimix_in_${Date.now()}.png`);
      const outputPath = path.join(tmpDir, `emojimix_out_${Date.now()}.webp`);
      fs.writeFileSync(inputPath, buffer);

      const comando = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -q:v 75 -y "${outputPath}"`;

      await new Promise((resolve, reject) => {
        exec(comando, (error) => (error ? reject(error) : resolve()));
      });

      const webpBuffer = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { sticker: webpBuffer });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('[emojimix]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el sticker de emojis.') });
    }
  }
};

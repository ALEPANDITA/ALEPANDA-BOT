const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { advertencia, error: cajaError } = require('../../lib/estilo');

async function pedirSticker(texto, intento = 1) {
  const res = await fetch(`https://skyzxu-brat.hf.space/brat?text=${encodeURIComponent(texto)}`);
  if (res.status === 429 && intento <= 3) {
    const espera = Number(res.headers.get('retry-after')) || 5;
    await new Promise(r => setTimeout(r, espera * 1000));
    return pedirSticker(texto, intento + 1);
  }
  if (!res.ok) throw new Error(`API respondio ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = {
  name: 'brat',
  category: 'fun',
  description: 'Crea un sticker estilo brat con un texto (o respondiendo a un mensaje)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const escrito = partes.slice(1).join(' ').trim();

    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;

    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}brat Hola mundo`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      });
    }

    try {
      const buffer = await pedirSticker(textoFinal);

      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `brat_in_${Date.now()}.png`);
      const outputPath = path.join(tmpDir, `brat_out_${Date.now()}.webp`);
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
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el sticker brat. La API puede estar caida.') });
    }
  }
};

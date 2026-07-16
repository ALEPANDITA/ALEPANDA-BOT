const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'qc',
  category: 'fun',
  description: 'Crea un sticker tipo cita con un texto (o respondiendo a un mensaje)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const escrito = partes.slice(1).join(' ').trim();

    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;

    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}qc Hola mundo`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      });
    }

    if (textoFinal.length > 200) {
      return sock.sendMessage(jid, { text: cajaError('El texto es muy largo (maximo 200 caracteres).') });
    }

    try {
      const remitenteCitado = contextInfo?.participant || msg.key.participant || jid;
      const nombre = msg.pushName || remitenteCitado.split('@')[0];
      const fotoPerfil = await sock.profilePictureUrl(remitenteCitado, 'image').catch(() => 'https://telegra.ph/file/24fa902ead26340f3df2c.png');

      const quoteObj = {
        type: 'quote', format: 'png', backgroundColor: '#000000',
        width: 512, height: 768, scale: 2,
        messages: [{ entities: [], avatar: true, from: { id: 1, name: nombre, photo: { url: fotoPerfil } }, text: textoFinal, replyMessage: {} }]
      };

      const respuesta = await fetch('https://bot.lyo.su/quote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteObj)
      });
      const json = await respuesta.json();
      const buffer = Buffer.from(json.result.image, 'base64');

      const tmpDir = os.tmpdir();
      const inputPath = path.join(tmpDir, `qc_in_${Date.now()}.png`);
      const outputPath = path.join(tmpDir, `qc_out_${Date.now()}.webp`);
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
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el sticker de cita.') });
    }
  }
};

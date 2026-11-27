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

// .brat audio <texto> -> sticker brat animado (hoja blanca, las palabras aparecen al ritmo de la voz) CON SONIDO.
// Se manda igual que .sa (lib/stickersonido.js). Tambien: .brat voz / loquendo / -audio / --audio / -voz / --voz, y .brataudio / .bratvoz
const MODOS_VOZ = ['audio', 'voz', 'loquendo', '-audio', '--audio', '-voz', '--voz'];
const ALIAS_VOZ = ['brataudio', 'bratvoz', 'bratloquendo'];

async function bratConVoz(sock, jid, msg, textoFinal) {
  const { crearBratConVoz, MAX_CARACTERES, SEGUNDOS_MAX } = require('../../lib/bratvoz');
  const { enviarSonoro, parcheActivo } = require('../../lib/stickersonido');
  const { AUTOR_POR_DEFECTO } = require('../../lib/stickerlib');
  if (!parcheActivo()) {
    return sock.sendMessage(jid, { text: cajaError('Falta activar el parche de la libreria para stickers con sonido (scripts/parche-sticker-sonido.js) y reiniciar el bot.') }, { quoted: msg });
  }
  try {
    await sock.sendMessage(jid, { text: '🔊 Preparando tu brat con voz...' }, { quoted: msg });
    const brat = await crearBratConVoz(textoFinal, { author: `${AUTOR_POR_DEFECTO} ${msg.pushName || 'Usuario'}` });
    await enviarSonoro(sock, jid, brat);
  } catch (err) {
    console.error('[brat voz]', err);
    let motivo;
    if (err.message === 'SIN_PARCHE') motivo = 'Falta activar el parche de la libreria para stickers con sonido.';
    else if (err.message === 'SIN_VOZ') motivo = 'Falta instalar la voz del bot en el servidor (espeak-ng).';
    else if (err.message === 'TEXTO_LARGO') motivo = `Ese texto es muy largo. Usa maximo ${MAX_CARACTERES} caracteres.`;
    else if (err.message === 'MUY_LARGO') motivo = `Ese texto dura mas de ${SEGUNDOS_MAX} segundos hablado. Acortalo un poco.`;
    else if (err.code === 'ENOENT') motivo = 'No encontre ffmpeg en el servidor.';
    else if (/muy pesado/.test(err.message)) motivo = err.message;
    else motivo = 'No se pudo crear el brat con voz.';
    await sock.sendMessage(jid, { text: cajaError(motivo) }, { quoted: msg });
  }
}

module.exports = {
  name: 'brat',
  aliasesOcultas: ALIAS_VOZ,
  category: 'fun',
  description: 'Crea un sticker estilo brat con un texto (o respondiendo a un mensaje). Con audio: .brat audio texto (animado y con voz)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const comandoEscrito = String(partes[0] || '').replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
    let resto = partes.slice(1);
    let conVoz = ALIAS_VOZ.includes(comandoEscrito);
    if (!conVoz && resto.length && MODOS_VOZ.includes(resto[0].toLowerCase())) { conVoz = true; resto = resto.slice(1); }
    const escrito = resto.join(' ').trim();

    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;

    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}brat Hola mundo\nCon voz y animado: ${prefix}brat audio Hola mundo`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      });
    }

    if (conVoz) return bratConVoz(sock, jid, msg, textoFinal);

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

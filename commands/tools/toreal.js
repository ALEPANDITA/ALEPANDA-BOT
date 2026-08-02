const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const PROMPT_REALISTA = 'turn this illustration into a photorealistic, ultra detailed real photograph, natural lighting, realistic skin and material textures, keep the same pose, composition, framing and colors';

module.exports = {
  name: 'toreal',
  aliases: ['realista', 'hazlareal'],
  category: 'tools',
  description: 'Responde a una imagen con .toreal para convertirla en una version realista (gratis, sin api key)',
  execute: async (sock, jid, msg) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = citado?.imageMessage
      ? { message: citado }
      : msg.message.imageMessage
        ? msg
        : null;

    if (!mensajeConImagen) {
      return sock.sendMessage(jid, {
        text: 'Responde a una imagen con .toreal (o .realista) para convertirla en una version realista.'
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: '🎨 Transformando la imagen a version realista...' }, { quoted: msg });

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});

      const formSubida = new FormData();
      formSubida.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'entrada.jpg');

      const respuestaSubida = await fetch('https://evogb.win/api/upload', {
        method: 'POST',
        body: formSubida
      });
      const datosSubida = await respuestaSubida.json();

      if (!datosSubida?.success || !datosSubida?.url) {
        throw new Error('No se pudo subir la imagen al hosting temporal (Evogb no respondio bien).');
      }

      const urlImagenOriginal = datosSubida.url;

      const promptCodificado = encodeURIComponent(PROMPT_REALISTA);
      const urlTransformacion = `https://image.pollinations.ai/prompt/${promptCodificado}` +
        `?model=kontext&image=${encodeURIComponent(urlImagenOriginal)}&width=1024&height=1024&nologo=true`;

      const respuestaImagen = await fetch(urlTransformacion);
      if (!respuestaImagen.ok) {
        throw new Error(`Pollinations respondio con error ${respuestaImagen.status}. Puede que este saturado, intenta de nuevo en un momento.`);
      }

      const bufferResultado = Buffer.from(await respuestaImagen.arrayBuffer());

      if (bufferResultado.length < 1000) {
        throw new Error('La imagen que regreso parece invalida o vacia. Intenta de nuevo.');
      }

      await sock.sendMessage(jid, {
        image: bufferResultado,
        caption: '✅ Version realista lista (Pollinations · gratis).'
      }, { quoted: msg });
    } catch (err) {
      console.error('[toreal] error:', err);
      await sock.sendMessage(jid, { text: `No se pudo transformar la imagen: ${err.message}` }, { quoted: msg });
    }
  }
};

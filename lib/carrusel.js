// Carrusel deslizable para el fork ultra-baileys.
// Adjunta el nodo <biz> a mano (el fork no lo agrega solo en carruseles).
const baileys = require('@whiskeysockets/baileys');
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = baileys;

function conTimeout(promesa, ms, mensajeError) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensajeError)), ms))
  ]);
}

function nodoBiz() {
  if (typeof baileys.getBizBinaryNode !== 'function') {
    throw new Error('Este Baileys no exporta getBizBinaryNode');
  }
  return baileys.getBizBinaryNode({
    interactiveMessage: { nativeFlowMessage: { buttons: [{ name: 'quick_reply' }] } }
  });
}

// opciones: { texto, footer, titulo, subtitulo, tarjetas }
// tarjeta:  { imagen, titulo, texto, botones: [{ texto, id } | { texto, url }] }
async function enviarCarrusel(sock, jid, msg, { texto, footer = 'ALEPANDA BOT', titulo = '', subtitulo = '', tarjetas = [] }) {
  if (!tarjetas.length) throw new Error('El carrusel no tiene tarjetas');
  const IM = proto.Message.InteractiveMessage;

  const cards = await Promise.all(tarjetas.map(async (t, i) => {
    let img = null;
    if (t.imagen) {
      try {
        img = await conTimeout(
          prepareWAMessageMedia({ image: { url: t.imagen } }, { upload: sock.waUploadToServer }),
          7000,
          `Timeout preparando la imagen ${i + 1}`
        );
      } catch (e) {
        console.warn(`[carrusel] imagen ${i + 1}:`, e.message);
      }
    }
    return {
      header: IM.Header.fromObject({
        title: t.titulo || '',
        hasMediaAttachment: !!img,
        imageMessage: img?.imageMessage || null
      }),
      body: IM.Body.fromObject({ text: t.texto || ' ' }),
      nativeFlowMessage: IM.NativeFlowMessage.fromObject({
        buttons: (t.botones || []).map((b) => b.url
          ? { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: b.texto, url: b.url, merchant_url: b.url }) }
          : { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.texto, id: b.id }) })
      })
    };
  }));

  const interactiveMessage = IM.create({
    body: IM.Body.fromObject({ text: texto || ' ' }),
    footer: IM.Footer.fromObject({ text: footer }),
    header: IM.Header.fromObject({ title: titulo, subtitle: subtitulo, hasMediaAttachment: false }),
    carouselMessage: IM.CarouselMessage.fromObject({ cards, messageVersion: 1 })
  });

  const contenido = proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage
      }
    }
  });

  const mensaje = generateWAMessageFromContent(jid, contenido, { quoted: msg, userJid: sock.user?.id });
  await sock.relayMessage(jid, mensaje.message, {
    messageId: mensaje.key.id,
    additionalNodes: [nodoBiz()]
  });
}

module.exports = { enviarCarrusel };

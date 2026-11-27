const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { advertencia, error: cajaError } = require('../../lib/estilo');
const { crearSticker, PACKNAME_POR_DEFECTO, AUTOR_POR_DEFECTO } = require('../../lib/stickerlib');

const SEGUNDOS_MAXIMOS_VIDEO = 15;

// Busca la imagen/video/sticker: primero en el mensaje mismo (con caption) y luego en el que respondes
function encontrarMedia(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const fuentes = [
    { contenedor: msg.message, objeto: msg },
    { contenedor: citado, objeto: citado ? { message: citado } : null }
  ];
  for (const { contenedor, objeto } of fuentes) {
    if (!contenedor) continue;
    if (contenedor.imageMessage) return { tipo: 'imagen', objeto };
    if (contenedor.videoMessage) return { tipo: 'video', objeto, segundos: Number(contenedor.videoMessage.seconds) || 0 };
    if (contenedor.stickerMessage) return { tipo: 'sticker', objeto };
  }
  return null;
}

// "mi paquete | mi autor" -> { packname, author }
function leerPaqueteYAutor(texto, nombreUsuario) {
  const resto = String(texto || '').trim().split(/\s+/).slice(1).join(' ').trim();
  if (!resto) return { packname: PACKNAME_POR_DEFECTO, author: `${AUTOR_POR_DEFECTO} ${nombreUsuario}` };
  const [paquete, ...autor] = resto.split('|');
  return {
    packname: paquete.trim().slice(0, 60) || PACKNAME_POR_DEFECTO,
    author: autor.join('|').trim().slice(0, 60) || `${AUTOR_POR_DEFECTO} ${nombreUsuario}`
  };
}

module.exports = {
  name: 'sticker',
  aliases: ['s'],
  category: 'fun',
  description: 'Convierte imagen, video/gif o sticker en sticker con tu paquete. Uso: .s  o  .s paquete | autor',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const media = encontrarMedia(msg);

    if (!media) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Responde a una imagen, video, gif o sticker con ${prefix}s\nTambien puedes poner tu propio paquete: ${prefix}s Mi paquete | Mi nombre`,
          { titulo: 'FALTA LA IMAGEN', estilo: 'kawaii' }
        )
      }, { quoted: msg });
    }

    if (media.tipo === 'video' && media.segundos > SEGUNDOS_MAXIMOS_VIDEO) {
      return sock.sendMessage(jid, {
        text: advertencia(`Ese video dura ${media.segundos} s. Usa uno de maximo ${SEGUNDOS_MAXIMOS_VIDEO} s (se toman los primeros 6).`)
      }, { quoted: msg });
    }

    try {
      const buffer = await downloadMediaMessage(media.objeto, 'buffer', {});
      const { packname, author } = leerPaqueteYAutor(texto, msg.pushName || 'Usuario');

      const sticker = await crearSticker(buffer, {
        animado: media.tipo === 'video',
        yaEsSticker: media.tipo === 'sticker',
        packname,
        author
      });

      await sock.sendMessage(jid, { sticker }, { quoted: msg });
    } catch (err) {
      console.error('[sticker]', err);
      const motivo = err.code === 'ENOENT'
        ? 'No encontre ffmpeg en el servidor.'
        : (/muy pesado/.test(err.message) ? err.message : 'No se pudo crear el sticker.');
      await sock.sendMessage(jid, { text: cajaError(motivo) }, { quoted: msg });
    }
  }
};

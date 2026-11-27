// Fabrica de los comandos de sticker con sonido: .sa (normal) y .sv (VIP: EXIF premium + isAvatar).
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { advertencia, error: cajaError } = require('./estilo');
const { crearSonoro, enviarSonoro, parcheActivo, SEGUNDOS_MAX } = require('./stickersonido');
const { PACKNAME_POR_DEFECTO, AUTOR_POR_DEFECTO } = require('./stickerlib');

const MAX_MB = 25;

// Video que mandas con el comando de pie de foto, o el video al que respondes
function encontrarVideo(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (msg.message?.videoMessage) return { objeto: msg, nodo: msg.message.videoMessage };
  if (citado?.videoMessage) return { objeto: { message: citado }, nodo: citado.videoMessage };
  return null;
}

function leerPaqueteYAutor(texto, nombreUsuario) {
  const resto = String(texto || '').trim().split(/\s+/).slice(1).join(' ').trim();
  if (!resto) return { packname: PACKNAME_POR_DEFECTO, author: `${AUTOR_POR_DEFECTO} ${nombreUsuario}` };
  const [paquete, ...autor] = resto.split('|');
  return { packname: paquete.trim().slice(0, 60) || PACKNAME_POR_DEFECTO, author: autor.join('|').trim().slice(0, 60) || `${AUTOR_POR_DEFECTO} ${nombreUsuario}` };
}

function crearComando({ name, aliases, vip }) {
  const alias = aliases[0];
  return {
    name,
    aliases,
    category: 'fun',
    description: vip
      ? `Sticker VIP con sonido (estrella + audio, primeros ${SEGUNDOS_MAX} s). Responde a un video con .${alias}  o  .${alias} paquete | autor`
      : `Convierte un video con audio en sticker CON SONIDO (primeros ${SEGUNDOS_MAX} s). Responde a un video con .${alias}  o  .${alias} paquete | autor`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      const video = encontrarVideo(msg);
      if (!video) {
        return sock.sendMessage(jid, { text: advertencia(`Responde a un *video con audio* con ${prefix}${alias} y lo convierto en sticker ${vip ? 'VIP ' : ''}con sonido 🔊\n(Se usan los primeros ${SEGUNDOS_MAX} segundos)\nTambien: ${prefix}${alias} Mi paquete | Mi nombre`, { titulo: 'FALTA EL VIDEO', estilo: 'kawaii' }) }, { quoted: msg });
      }
      const mb = Number(video.nodo.fileLength || 0) / (1024 * 1024);
      if (mb > MAX_MB) return sock.sendMessage(jid, { text: advertencia(`Ese video pesa ${mb.toFixed(0)} MB. Usa uno de maximo ${MAX_MB} MB.`) }, { quoted: msg });
      if (!parcheActivo()) {
        return sock.sendMessage(jid, { text: cajaError('Falta activar el parche de la libreria para stickers con sonido (scripts/parche-sticker-sonido.js) y reiniciar el bot.') }, { quoted: msg });
      }

      try {
        await sock.sendMessage(jid, { text: vip ? '🌟 Preparando tu sticker VIP con sonido...' : '🔊 Preparando tu sticker con sonido...' }, { quoted: msg });
        const buffer = await downloadMediaMessage(video.objeto, 'buffer', {});
        const { packname, author } = leerPaqueteYAutor(texto, msg.pushName || 'Usuario');
        const sonoro = await crearSonoro(buffer, { packname, author, vip });
        await enviarSonoro(sock, jid, sonoro, { vip });
      } catch (err) {
        console.error(`[${name}]`, err);
        let motivo;
        if (err.message === 'SIN_AUDIO') motivo = `Ese video no tiene sonido. Para un sticker normal usa ${prefix}s`;
        else if (err.message === 'SIN_PARCHE') motivo = 'Falta activar el parche de la libreria para stickers con sonido.';
        else if (err.code === 'ENOENT') motivo = 'No encontre ffmpeg en el servidor.';
        else if (/muy pesado/.test(err.message)) motivo = err.message;
        else motivo = 'No se pudo crear el sticker con sonido.';
        await sock.sendMessage(jid, { text: cajaError(motivo) }, { quoted: msg });
      }
    }
  };
}

module.exports = { crearComando };

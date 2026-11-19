// .guardarhoja <carpeta>  -> guarda la imagen (o la imagen a la que respondes) como assets/<carpeta>/hoja.<ext>
// La usan los comandos de logo (.logogato, etc.) para sacar sus personajes. Solo owner.
// Tip: mandala como DOCUMENTO (sin comprimir) para que quede con la mejor calidad.
const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, error: cajaError } = require('../../lib/estilo');

const RAIZ = path.join(__dirname, '..', '..', 'assets');

function extensionDe(mime) {
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  return 'jpg';
}

module.exports = {
  name: 'guardarhoja',
  category: 'owner',
  description: 'Guarda la imagen (o la citada) para un comando de logo. Uso: .guardarhoja <carpeta>  (ej: .guardarhoja gato)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const autorizado = await esOwnerBot(sock, leerConfig(), msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const carpeta = String(texto || '').trim().split(/\s+/)[1] || '';
    if (!/^[a-z0-9_-]{2,20}$/.test(carpeta)) {
      return sock.sendMessage(jid, {
        text: advertencia(`Dime la carpeta.\nEjemplo: responde a la imagen con ${prefix}guardarhoja gato`, { titulo: 'FALTA LA CARPETA', estilo: 'neon' })
      }, { quoted: msg });
    }

    const esImagen = (m) => (m?.imageMessage ? m.imageMessage : (m?.documentMessage && /^image\//i.test(m.documentMessage.mimetype || '') ? m.documentMessage : null));
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mensajeConImagen = esImagen(citado) ? { message: citado } : (esImagen(msg.message) ? msg : null);
    if (!mensajeConImagen) {
      return sock.sendMessage(jid, { text: advertencia('Responde a una imagen (o mandala con el comando en el texto).', { titulo: 'FALTA LA IMAGEN', estilo: 'neon' }) }, { quoted: msg });
    }

    try {
      const buffer = await downloadMediaMessage(mensajeConImagen, 'buffer', {});
      const datos = esImagen(mensajeConImagen.message);
      const ext = extensionDe(datos.mimetype || '');
      const dir = path.join(RAIZ, carpeta);
      fs.mkdirSync(dir, { recursive: true });
      for (const f of fs.readdirSync(dir)) if (/^hoja\.(png|jpe?g|webp)$/i.test(f)) fs.unlinkSync(path.join(dir, f)); // solo queda una hoja
      fs.writeFileSync(path.join(dir, `hoja.${ext}`), buffer);
      await sock.sendMessage(jid, {
        text: exito(`Imagen guardada en assets/${carpeta}/hoja.${ext} (${(buffer.length / 1024).toFixed(0)} KB). Ya puedes usar el comando de logo.`, { titulo: 'IMAGEN GUARDADA', estilo: 'neon' })
      }, { quoted: msg });
    } catch (err) {
      console.error('[guardarhoja]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo guardar la imagen.', { estilo: 'neon' }) }, { quoted: msg });
    }
  }
};

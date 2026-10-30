const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getApiKey } = require('../../lib/apikeys');
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'triggered',
  aliases: ['trig', 'gif'],
  category: 'fun',
  description: 'Crea un GIF animado triggered respondiendo a una imagen. Uso: responde a una imagen con .triggered',
  execute: async (sock, jid, msg, { prefix }) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = quoted?.imageMessage || (msg.message?.imageMessage);

    if (!isImage) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Por favor, responde a una imagen con el comando ${prefix}triggered`, { titulo: 'FALTA IMAGEN' }) 
      });
    }

    try {
      await sock.sendMessage(jid, { text: '🔄 Generando GIF animado, por favor espera...' });

      // Descargar la imagen citada o la enviada en el mismo mensaje
      const targetMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage 
        ? { message: quoted } 
        : msg;

      const buffer = await downloadMediaMessage(
        targetMsg,
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer) {
        throw new Error('No se pudo descargar la imagen.');
      }

      // Como la API requiere una URL pública y no tenemos un host propio, 
      // subimos temporalmente o usamos el servicio de subida si está disponible, 
      // o bien evaluamos si la API soporta multipart/form-data. 
      // Si la API solo acepta parámetro url, podemos subir la imagen a un servicio catbox u omitir si Baileys permite enlace directo.
      // Ya que el owner pasó un método por url, subiremos el buffer a una API temporal pública (ej: uplfiles o pomf) o usaremos un método alternativo de subida rápida.
      // Vamos a usar un fetch rápido a una API de subida temporal anónima (pomf2.lain.la) para obtener la URL pública requerida por la API de Evogb.

      const formData = new FormData();
      formData.append('files[]', new Blob([buffer]), 'image.jpg');

      const uploadRes = await fetch('https://pomf2.lain.la/upload.php', {
        method: 'POST',
        body: formData
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.success || !uploadJson.files?.[0]?.url) {
        throw new Error('No se pudo procesar la imagen para la API.');
      }

      const imageUrl = uploadJson.files[0].url;
      const apiKey = getApiKey('evogb') || 'evogb-WPHlBOdu';
      const apiUrl = `https://api.evogb.org/generate/animated-gif?key=${apiKey}&method=url&url=${encodeURIComponent(imageUrl)}&gifType=triggered&timeout=50`;

      const apiRes = await fetch(apiUrl);
      if (!apiRes.ok) {
        throw new Error('La API de generación respondió con un error.');
      }

      const resultBuffer = Buffer.from(await apiRes.arrayBuffer());

      await sock.sendMessage(jid, {
        video: resultBuffer,
        mimetype: 'video/mp4',
        gifPlayback: true,
        caption: '✨ ¡Aquí tienes tu GIF triggered!'
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { 
        text: cajaError('Ocurrió un error al crear el GIF: ' + err.message) 
      });
    }
  }
};
const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'sixtynine',
  aliases: ['69'],
  category: 'nsfw',
  description: 'Envía un GIF/imagen NSFW de https://prexzyapis.com/nsfw/sixtynine. Uso: .sixtynine',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    if (args.length) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}sixtynine`, { titulo: 'EXTRA INFO' }) });
    }
    const url = 'https://prexzyapis.com/nsfw/sixtynine';
    
    // Usamos AbortController para evitar que el fetch se quede colgado indefinidamente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image') && !contentType.includes('gif')) {
        throw new Error('El servidor no devolvió una imagen o GIF válido.');
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (buffer.length === 0) {
        throw new Error('Se recibió un archivo vacío.');
      }

      await sock.sendMessage(jid, {
        image: buffer,
        mimetype: contentType.includes('gif') ? 'image/gif' : 'image/jpeg'
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      const errorMsg = err.name === 'AbortError' 
        ? 'La solicitud tardó demasiado en responder.' 
        : 'No se pudo obtener el contenido NSFW.';
      await sock.sendMessage(jid, { text: cajaError(errorMsg) });
    }
  }
};
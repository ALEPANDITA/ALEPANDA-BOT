const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'loli2',
  category: 'nsfw',
  description: 'Envía una imagen anime loli con mención interactiva.',
  execute: async (sock, jid, msg, { prefix }) => {
    // Obtener el JID del remitente que usó el comando
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNum = sender.split('@')[0];

    try {
      const url = 'https://api.delirius.online/anime/loli';
      
      // Hacemos fetch al endpoint que devuelve directamente la imagen (no JSON)
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('No se pudo obtener la imagen de la API');
      }

      // Convertimos la respuesta a un Buffer
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Enviamos la imagen con mención al usuario que ejecutó el comando
      await sock.sendMessage(jid, {
        image: buffer,
        caption: `✨ ¡Aquí tienes tu imagen, @${senderNum}! ✨`,
        mentions: [sender]
      }, { quoted: msg });

    } catch (err) {
      console.error(err);
      
      // Responder amigablemente en caso de error
      const mensajeError = typeof cajaError === 'function' 
        ? cajaError('No se pudo cargar la imagen en este momento. Inténtalo más tarde.') 
        : 'Ocurrió un error al intentar obtener la imagen.';
        
      await sock.sendMessage(jid, { text: mensajeError });
    }
  }
};
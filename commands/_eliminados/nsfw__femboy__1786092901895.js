const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'femboy',
  aliases: ['nsfwfemboy'],
  category: 'nsfw',
  description: 'Envía una imagen NSFW de femboy. Uso: .femboy',
  execute: async (sock, jid, msg, ctx) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const userTag = `@${sender.split('@')[0]}`;

    try {
      // Realizamos la petición al endpoint para obtener el JSON
      const res = await fetch('https://api.waifu.pics/nsfw/trap');

      if (!res.ok) {
        throw new Error(`El servidor respondió con estado ${res.status}`);
      }

      const json = await res.json();
      
      // El owner indica que la imagen se encuentra en urls[0]. 
      // Por seguridad, damos soporte prioritario a json.urls[0] y fallback a json.url.
      const imgUrl = (json.urls && Array.isArray(json.urls) && json.urls[0]) ? json.urls[0] : json.url;

      if (!imgUrl) {
        throw new Error('No se encontró una URL de imagen válida en la respuesta de la API');
      }

      // Enviamos la imagen obtenida desde la URL extraída del JSON
      await sock.sendMessage(
        jid,
        {
          image: { url: imgUrl },
          caption: `🔥 *NSFW Femboy*\n\nSolicitado por: ${userTag}`,
          mentions: [sender]
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error('Error en comando femboy:', err);
      await sock.sendMessage(
        jid,
        { text: cajaError('Ocurrió un error al obtener la imagen NSFW. Inténtalo más tarde.') },
        { quoted: msg }
      );
    }
  }
};
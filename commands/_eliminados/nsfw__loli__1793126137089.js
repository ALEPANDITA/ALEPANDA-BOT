const { error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'loli',
  aliases: ['lol', 'lolimage'],
  category: 'nsfw',
  description: 'Envía una imagen aleatoria de loli. Uso: .loli',
  execute: async (sock, jid, msg, { prefix }) => {
    const userJid = msg.key?.participant || msg.key?.remoteJid;
    const userTag = '@' + (userJid?.split('@')[0] ?? 'usuario');

    try {
      // Usamos una API que devuelve una imagen aleatoria en cada petición
      const apiUrl = 'https://nekos.best/api/v2/loli';
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const imageUrl = data.results?.[0]?.url;
      if (!imageUrl) throw new Error('Imagen no encontrada en la respuesta');

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `${userTag} ¡Mira esto!`,
        mentions: [userJid]
      });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, {
        text: cajaError('⚠️ No se pudo obtener la imagen, intenta más tarde.')
      });
    }
  }
};
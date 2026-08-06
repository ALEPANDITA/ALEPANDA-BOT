const { advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'danbooru',
  aliases: ['nsfwdanbooru', 'danboorusearch'],
  category: 'nsfw',
  description: 'Busca y envia imagenes de Danbooru (ej: .danbooru <keyword>)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const keyword = args.join(' ').trim();

    if (!keyword) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Uso correcto: ${prefix}danbooru <keyword>\nEjemplo: ${prefix}danbooru catgirl`, { titulo: 'FALTA INFORMACION' }) 
      });
    }

    try {
      const apiUrl = `https://api.evogb.org/nsfw/danbooru?keyword=${encodeURIComponent(keyword)}&key=evogb-WPHlBOdu`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Error en la API: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.status || !Array.isArray(data.results) || data.results.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para la búsqueda proporcionada.') });
      }

      // Seleccionar una imagen aleatoria de los resultados
      const randomImage = data.results[Math.floor(Math.random() * data.results.length)];

      if (!randomImage) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener una imagen válida del resultado.') });
      }

      // Obtener el JID del usuario que envió el mensaje para mencionarlo con @
      const senderJid = msg.key.participant || msg.key.remoteJid;

      await sock.sendMessage(jid, {
        image: { url: randomImage },
        caption: `Resultado para: *${keyword}*\nPedido por: @${senderJid.split('@')[0]}`,
        mentions: [senderJid]
      });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al procesar la solicitud de Danbooru: ' + err.message) });
    }
  }
};
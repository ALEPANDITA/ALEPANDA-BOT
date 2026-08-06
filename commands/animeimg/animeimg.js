const { error: cajaError, cargando } = require('../../lib/estilo');

module.exports = {
  name: 'animeimg',
  aliases: ['hentaivid'],
  category: 'nsfw',
  description: 'Envía un video aleatorio de anime/sfm. Uso: .animeimg',
  execute: async (sock, jid, msg, { prefix }) => {
    try {
      let loadingMsg;
      if (typeof cargando === 'function') {
        loadingMsg = await sock.sendMessage(jid, { text: cargando('Buscando video aleatorio...') });
      } else {
        loadingMsg = await sock.sendMessage(jid, { text: 'Buscando video aleatorio, por favor espera...' });
      }

      const response = await fetch('https://api.delirius.online/anime/hentaivid');
      if (!response.ok) {
        throw new Error(`Error en el servidor de la API (Status: ${response.status})`);
      }
      
      const json = await response.json();

      let items = [];
      if (Array.isArray(json)) {
        items = json;
      } else if (json && Array.isArray(json.data)) {
        items = json.data;
      } else if (json && Array.isArray(json.results)) {
        items = json.results;
      } else if (json && Array.isArray(json.result)) {
        items = json.result;
      }

      if (!items || items.length === 0) {
        const errorMsg = 'No se pudieron obtener videos válidos de la API.';
        return sock.sendMessage(jid, { text: typeof cajaError === 'function' ? cajaError(errorMsg) : errorMsg });
      }

      const randomItem = items[Math.floor(Math.random() * items.length)];

      const videoUrl = randomItem.video_1 || randomItem.video_2 || randomItem.link;
      if (!videoUrl) {
        const errorMsg = 'El video seleccionado no contiene un enlace de descarga válido.';
        return sock.sendMessage(jid, { text: typeof cajaError === 'function' ? cajaError(errorMsg) : errorMsg });
      }

      const title = randomItem.title || 'Sin título';
      const category = randomItem.category || 'General';
      const views = randomItem.views_count || 'Desconocido';

      const sender = msg.key.participant || msg.key.remoteJid || '';
      const senderTag = sender.includes('@') ? sender.split('@')[0] : 'usuario';

      const caption = `🎬 *Título:* ${title}\n📂 *Categoría:* ${category}\n👀 *Vistas:* ${views}\n\nDisfruta tu video, @${senderTag} 😈`;

      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: caption,
        mimetype: 'video/mp4',
        mentions: sender ? [sender] : []
      });

    } catch (err) {
      console.error(err);
      const errorMsg = 'Ocurrió un error al procesar el comando: ' + err.message;
      await sock.sendMessage(jid, { text: typeof cajaError === 'function' ? cajaError(errorMsg) : errorMsg });
    }
  }
};
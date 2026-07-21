const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'instagramv2',
  category: 'download',
  description: 'Descarga un post de Instagram (soporta varias fotos/videos en un mismo post)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'instagramv2 ').length).trim();

    if (!url || !url.includes('instagram.com')) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}instagramv2 <link del post>`, { titulo: 'INSTAGRAM V2' })
      });
    }

    await sock.sendMessage(jid, {
      text: cargando('Descargando de Instagram...', { titulo: 'INSTAGRAM V2' })
    });

    try {
      const res = await fetch(`https://api.delirius.store/download/instagramv2?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!json.status || !json.data?.download?.length) {
        throw new Error('Respuesta invalida de la API');
      }

      const { username, fullname, likes, comments, caption } = json.data;
      const items = json.data.download;

      const pie = [
        `👤 ${fullname || username || 'Instagram'} (@${username || '-'})`,
        `❤️ ${likes ?? '-'}   💬 ${comments ?? '-'}`,
        caption ? `\n${caption}` : ''
      ].filter(Boolean).join('\n');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const textoCaption = i === 0 ? pie : '';

        if (item.type === 'video') {
          await sock.sendMessage(jid, { video: { url: item.url }, caption: textoCaption }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: { url: item.url }, caption: textoCaption }, { quoted: msg });
        }
      }
    } catch (err) {
      console.error('[instagramv2]', err);
      await sock.sendMessage(jid, { text: cajaError('No se pudo descargar ese post de Instagram.') });
    }
  }
};

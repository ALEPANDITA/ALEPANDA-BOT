const { error: cajaError, advertencia } = require('../../lib/estilo');

module.exports = [
  {
    name: 'nsfw',
    category: 'nsfw',
    description: 'Envía contenido NSFW aleatorio (ej: .nsfw <categoria>)',
    execute: async (sock, jid, msg, { prefix, texto }) => {
      const args = texto.trim().split(/\s+/).slice(1);
      const categoria = (args[0] || 'waifu').toLowerCase();
      
      const categoriasWaifu = ['waifu', 'neko', 'trap', 'blowjob'];
      const catFinal = categoriasWaifu.includes(categoria) ? categoria : 'waifu';

      let urlFinal = null;

      try {
        const response = await fetch(`https://api.waifu.pics/nsfw/${catFinal}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.url) {
            urlFinal = data.url;
          }
        }
      } catch (e) {
        // Ignorar y pasar al respaldo
      }

      if (!urlFinal) {
        try {
          const resFallback = await fetch('https://nekos.best/api/v2/neko');
          if (resFallback.ok) {
            const dataFallback = await resFallback.json();
            const resultado = dataFallback.results && dataFallback.results[0];
            if (resultado && resultado.url) {
              urlFinal = resultado.url;
            }
          }
        } catch (e) {
          // Ignorar
        }
      }

      if (!urlFinal) {
        try {
          const resCata = await fetch('https://nekos.life/api/v2/img/nsfw');
          if (resCata.ok) {
            const dataCata = await resCata.json();
            if (dataCata && dataCata.url) {
              urlFinal = dataCata.url;
            }
          }
        } catch (e) {
          // Ignorar
        }
      }

      if (!urlFinal) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener contenido NSFW en este momento, intenta más tarde.') }, { quoted: msg });
      }

      try {
        const isGif = urlFinal.endsWith('.gif');
        if (isGif) {
          await sock.sendMessage(jid, { video: { url: urlFinal }, gifPlayback: true, caption: `NSFW - ${catFinal}` }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: { url: urlFinal }, caption: `NSFW - ${catFinal}` }, { quoted: msg });
        }
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al enviar el contenido NSFW.') }, { quoted: msg });
      }
    }
  },
  {
    name: 'hentai',
    aliases: ['hneko', 'hwaifu'],
    category: 'nsfw',
    description: 'Envía una imagen o gif hentai de anime',
    execute: async (sock, jid, msg, { prefix, texto }) => {
      let urlFinal = null;

      try {
        const response = await fetch('https://api.waifu.pics/nsfw/waifu');
        if (response.ok) {
          const data = await response.json();
          if (data && data.url) {
            urlFinal = data.url;
          }
        }
      } catch (e) {
        // Pasar al respaldo
      }

      if (!urlFinal) {
        try {
          const resFallback = await fetch('https://nekos.best/api/v2/neko');
          if (resFallback.ok) {
            const dataFallback = await resFallback.json();
            const resultado = dataFallback.results && dataFallback.results[0];
            if (resultado && resultado.url) {
              urlFinal = resultado.url;
            }
          }
        } catch (e) {
          // Pasar al siguiente respaldo
        }
      }

      if (!urlFinal) {
        try {
          const resCata = await fetch('https://nekos.life/api/v2/img/nsfw');
          if (resCata.ok) {
            const dataCata = await resCata.json();
            if (dataCata && dataCata.url) {
              urlFinal = dataCata.url;
            }
          }
        } catch (e) {
          // Ignorar
        }
      }

      if (!urlFinal) {
        return sock.sendMessage(jid, { text: cajaError('No se pudo obtener contenido hentai en este momento, intenta más tarde.') }, { quoted: msg });
      }

      try {
        const isGif = urlFinal.endsWith('.gif');
        if (isGif) {
          await sock.sendMessage(jid, { video: { url: urlFinal }, gifPlayback: true, caption: 'Hentai / NSFW' }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: { url: urlFinal }, caption: 'Hentai / NSFW' }, { quoted: msg });
        }
      } catch (err) {
        console.error(err);
        await sock.sendMessage(jid, { text: cajaError('Ocurrio un error al procesar el comando hentai.') }, { quoted: msg });
      }
    }
  }
];
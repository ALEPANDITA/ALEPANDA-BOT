const { advertencia, error: cajaError, cargando, caja } = require('../../lib/estilo');

// Caché temporal para almacenar las listas de películas buscando por jid
const pelisCache = new Map();

module.exports = [
  {
    name: 'pelis',
    aliases: ['pelicula', 'movie'],
    category: 'download',
    description: 'Busca películas y muestra una lista para elegir y descargar. Uso: .pelis <término o nombre>',
    execute: async (sock, jid, msg, { texto, prefix }) => {
      const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();

      if (!query) {
        return sock.sendMessage(jid, {
          text: advertencia(`Uso correcto: ${prefix}pelis <palabra clave o nombre>`, { titulo: 'FALTA EL TÉRMINO' })
        });
      }

      try {
        await sock.sendMessage(jid, { text: cargando(`Buscando películas sobre "${query}", por favor espera...`) });

        let movieList = [];

        // Endpoints de búsqueda
        const apis = [
          `https://api.vreden.web.id/api/pelisplus?query=${encodeURIComponent(query)}`,
          `https://api.siputzx.my.id/api/s/pelisplus?query=${encodeURIComponent(query)}`,
          `https://deliriapi-oficial.vercel.app/search/pelisplus?query=${encodeURIComponent(query)}`
        ];

        for (const api of apis) {
          try {
            const response = await fetch(api);
            if (!response.ok) continue;

            const data = await response.json();
            const rawResults = data.resultado || data.data || data.result || data.results || (Array.isArray(data) ? data : null);

            if (rawResults) {
              const items = Array.isArray(rawResults) ? rawResults : [rawResults];

              for (const item of items) {
                if (item) {
                  const title = item.title || item.titulo || item.name;
                  let linkUrl = item.download || item.download_url || item.url || item.link || item.dl_url;

                  if (!linkUrl && item.servers && Array.isArray(item.servers) && item.servers.length > 0) {
                    linkUrl = item.servers[0].url || item.servers[0].link;
                  }

                  if (title && linkUrl) {
                    if (!movieList.some(m => m.title.toLowerCase() === title.toLowerCase())) {
                      movieList.push({
                        title: title.trim(),
                        url: linkUrl.trim()
                      });
                    }
                  }
                }
              }
            }

            if (movieList.length >= 6) break;
          } catch (e) {
            // Continuar con la siguiente API si una falla
          }
        }

        if (movieList.length === 0) {
          return sock.sendMessage(jid, {
            text: cajaError('No se encontraron películas para esa búsqueda. Intenta con un nombre más corto o general.')
          });
        }

        // Limitar resultados
        movieList = movieList.slice(0, 8);

        // Guardar en la caché con marca de tiempo
        pelisCache.set(jid, {
          timestamp: Date.now(),
          list: movieList
        });

        // Construir el mensaje con las opciones
        let menuText = `🎬 *PELÍCULAS ENCONTRADAS*\nBúsqueda: "${query}"\n\nResponde con el *número* de la película que deseas seleccionar:\n\n`;
        movieList.forEach((movie, index) => {
          menuText += `*${index + 1}.* ${movie.title}\n`;
        });
        menuText += `\n_Ejemplo: responde "1" o escribe "${prefix}pelis_handler 1" para obtener la primera opción._`;

        await sock.sendMessage(jid, { text: caja(menuText, { titulo: 'PELISPLUS BUSCADOR' }) });

      } catch (err) {
        console.error('Error en comando pelis:', err);
        await sock.sendMessage(jid, {
          text: cajaError('Ocurrió un error al procesar la búsqueda de películas.')
        });
      }
    }
  },
  {
    name: 'pelis_handler',
    description: 'Procesa la selección de película por número.',
    execute: async (sock, jid, msg, { texto }) => {
      // Si no existe caché para este chat, ignorar
      if (!pelisCache.has(jid)) return;

      // Extraer el número si fue ingresado directamente o con prefijo/comando
      const input = texto.trim().replace(/^[.\/#!]?(pelis_handler|pelis)\s*/i, '').trim();
      const respuestaNum = parseInt(input);

      if (isNaN(respuestaNum)) return;

      const cacheData = pelisCache.get(jid);
      const movieList = cacheData.list || [];

      if (respuestaNum < 1 || respuestaNum > movieList.length) {
        return sock.sendMessage(jid, {
          text: cajaError(`Por favor, responde con un número válido entre 1 y ${movieList.length}.`)
        });
      }

      const selectedMovie = movieList[respuestaNum - 1];
      pelisCache.delete(jid); // Limpiar sesión tras la selección

      try {
        await sock.sendMessage(jid, { text: cargando(`Obteniendo enlace de "${selectedMovie.title}"...`) });

        let mediaUrl = null;

        // Intentar obtener enlace directo a través de endpoints de resolución/detalle
        const detailApis = [
          `https://api.vreden.web.id/api/pelisplus/download?url=${encodeURIComponent(selectedMovie.url)}`,
          `https://api.siputzx.my.id/api/d/pelisplus?url=${encodeURIComponent(selectedMovie.url)}`
        ];

        for (const detailApi of detailApis) {
          try {
            const res = await fetch(detailApi);
            if (!res.ok) continue;
            const data = await res.json();
            const resObj = data.resultado || data.data || data.result;

            if (resObj) {
              const dl = resObj.download || resObj.download_url || resObj.url || resObj.link || resObj.stream;
              if (dl && typeof dl === 'string' && dl.startsWith('http')) {
                mediaUrl = dl;
                break;
              }
            }
          } catch (e) {
            // Ignorar y probar la siguiente fuente
          }
        }

        // Si no se obtuvo un enlace directo nuevo, usar la URL original de la lista
        if (!mediaUrl) {
          mediaUrl = selectedMovie.url;
        }

        // Verificar si la URL es directamente un archivo de video (.mp4, etc.)
        let isDirectFile = false;
        try {
          const headRes = await fetch(mediaUrl, { method: 'HEAD' });
          const contentType = headRes.headers.get('content-type') || '';
          if (contentType.includes('video') || contentType.includes('octet-stream') || mediaUrl.match(/\.(mp4|mkv|avi)$/i)) {
            isDirectFile = true;
          }
        } catch (e) {
          if (mediaUrl.match(/\.(mp4|mkv|avi)$/i)) {
            isDirectFile = true;
          }
        }

        if (isDirectFile) {
          const safeFileName = selectedMovie.title.replace(/[^a-zA-Z0-9 _-]/g, '');
          await sock.sendMessage(jid, {
            document: { url: mediaUrl },
            fileName: `${safeFileName}.mp4`,
            mimetype: 'video/mp4',
            caption: `🎬 *${selectedMovie.title}*\n\n¡Aquí tienes tu película!`
          });
        } else {
          // Si es una página de reproducción web o el archivo es externo
          const infoMsg = `🎬 *${selectedMovie.title}*\n\n` +
            `🍿 *Enlace de la película:* ${mediaUrl}\n\n` +
            `_Abre el enlace en tu navegador para reproducir o descargar la película directamente en tu dispositivo._`;

          await sock.sendMessage(jid, { text: caja(infoMsg, { titulo: 'PELÍCULA DISPONIBLE' }) });
        }

      } catch (err) {
        console.error('Error en pelis_handler:', err);
        // Si la carga directa falla, proporcionar el enlace web como respaldo sin tumbar el bot
        const fallbackMsg = `🎬 *${selectedMovie.title}*\n\n` +
          `No se pudo enviar el archivo multimedia directamente al chat.\n\n` +
          `🔗 *Ver/Descargar desde el navegador:* ${selectedMovie.url}`;

        await sock.sendMessage(jid, { text: caja(fallbackMsg, { titulo: 'ENLACE DE RESPALDO' }) });
      }
    }
  }
];
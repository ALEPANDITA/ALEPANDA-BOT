const { advertencia, error: cajaError } = require('../../lib/estilo');

let generateWAMessageFromContent, prepareWAMessageMedia;
try {
  const baileys = require('@whiskeysockets/baileys');
  generateWAMessageFromContent = baileys.generateWAMessageFromContent;
  prepareWAMessageMedia = baileys.prepareWAMessageMedia;
} catch (e) {
  // Ignorar si no esta disponible directamente
}

async function intentarCarrusel(sock, jid, msg, query, resultados, prefix) {
  if (!generateWAMessageFromContent || !prepareWAMessageMedia) return false;
  try {
    const cards = [];
    const maxResults = Math.min(resultados.length, 8);

    for (let i = 0; i < maxResults; i++) {
      const video = resultados[i];
      const title = video.title || 'Sin título';
      const duration = video.duration || 'N/A';
      const quality = video.quality || 'N/A';
      const coverUrl = video.image || video.thumbnail || 'https://i.imgur.com/3Z4m23V.jpeg';

      let imageMessage = null;
      try {
        const mediaMessage = await prepareWAMessageMedia({ image: { url: coverUrl } }, { upload: sock.waUploadToServer });
        imageMessage = mediaMessage.imageMessage;
      } catch (e) {
        // Continuar sin imagen si falla la descarga o preparacion
      }

      const card = {
        header: {
          hasMediaAttachment: Boolean(imageMessage),
          ...(imageMessage ? { imageMessage } : {}),
          title: `🎬 ${i + 1}. ${title.slice(0, 50)}`
        },
        body: {
          text: `⏱️ Duración: ${duration}\n⭐ Calidad: ${quality}`
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: 'Descargar',
                id: `${prefix}xvd ${video.url}`
              })
            }
          ]
        }
      };

      cards.push(card);
    }

    if (cards.length === 0) return false;

    const interactiveMsg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: `Resultados de búsqueda para: *${query}*`
            },
            footer: {
              text: 'Desliza para ver los 8 resultados'
            },
            carouselMessage: {
              cards: cards
            }
          }
        }
      }
    }, { quoted: msg });

    await sock.relayMessage(jid, interactiveMsg.message, { messageId: interactiveMsg.key.id });
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  name: 'xvideos',
  aliases: ['xv', 'xvideo'],
  category: 'nsfw2',
  description: 'Busca videos en XVideos (ej: .xvideos anime)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!query) {
      return sock.sendMessage(jid, { 
        text: advertencia(`Uso correcto: ${prefix}xvideos <búsqueda>\nEjemplo: ${prefix}xvideos anime`, { titulo: 'FALTA INFORMACIÓN' }) 
      });
    }

    try {
      // Se consulta una página aleatoria entre 1 y 3 para garantizar variedad de resultados
      const randomPage = Math.floor(Math.random() * 3) + 1;
      let response = await fetch(`https://api.delirius.online/search/xvideos?query=${encodeURIComponent(query)}&page=${randomPage}`);
      let json = null;

      if (response.ok) {
        json = await response.json();
      }

      // Si la búsqueda con página no trae resultados o no es soportada, reintentar sin página
      if (!json || !json.status || !json.data || !Array.isArray(json.data) || json.data.length === 0) {
        response = await fetch(`https://api.delirius.online/search/xvideos?query=${encodeURIComponent(query)}`);
        if (response.ok) {
          json = await response.json();
        }
      }

      if (!json || !json.status || !json.data || !Array.isArray(json.data) || json.data.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados para tu búsqueda.') });
      }

      const validData = json.data.filter(video => video && video.title && video.url && !video.url.endsWith('undefined'));
      if (validData.length === 0) {
        return sock.sendMessage(jid, { text: cajaError('No se encontraron resultados válidos para tu búsqueda.') });
      }

      // Aleatorizar la lista de resultados recibidos para mayor variedad
      const shuffled = [...validData].sort(() => Math.random() - 0.5);
      const results = shuffled.slice(0, 8);

      // Guardar la sesión para permitir descarga por número o enlace
      global.xvideosSessions = global.xvideosSessions || {};
      global.xvideosSessions[jid] = results.map(v => v.url);

      // Intentar envío mediante carrusel interactivo
      const carruselEnviado = await intentarCarrusel(sock, jid, msg, query, results, prefix);
      if (carruselEnviado) {
        return;
      }

      // Fallback: Si el carrusel falla, enviar lista consolidada de 8 videos
      let fallbackText = `🎬 *RESULTADOS DE XVIDEOS (${results.length})*\n🔍 *Búsqueda:* ${query}\n\n`;
      results.forEach((video, index) => {
        const title = video.title || 'Sin título';
        const duration = video.duration || 'N/A';
        const quality = video.quality || 'N/A';
        fallbackText += `*${index + 1}.* ${title}\n⏱️ Duración: ${duration} | ⭐ Calidad: ${quality}\n🔗 ${video.url}\n\n`;
      });
      fallbackText += `📌 *Para descargar responde:* \`${prefix}xvd <número>\` o \`${prefix}xvd <link>\``;

      await sock.sendMessage(jid, { text: fallbackText }, { quoted: msg });

    } catch (err) {
      console.error('Error en xvideos:', err);
      await sock.sendMessage(jid, { text: cajaError('Ocurrió un error al realizar la búsqueda en XVideos.') });
    }
  }
};
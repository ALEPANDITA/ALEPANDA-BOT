const { buscarYoutubeVarios, limpiarTexto } = require('../../../lib/dvyerapi');
const { guardarBusqueda } = require('../../../lib/busquedas');
const { generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia } = require('@whiskeysockets/baileys');

function formatearDuracion(segundos = 0) {
  const sec = Number(segundos) || 0;
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

function formatearVistas(numero = 0) {
  const n = Number(numero) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// Intenta primero con la libreria yt-search (busqueda directa, sin depender
// de la API externa). Si falla -por ejemplo el bloqueo 302 que da YouTube
// a IPs de datacenter/VPS- cae automaticamente a la API DVYER.
async function buscarConLibreria(query, limit) {
  const ytSearch = require('yt-search');
  const { videos } = await ytSearch(query);
  return (videos || []).slice(0, limit).map(v => ({
    url: v.url,
    title: v.title,
    thumbnail: v.thumbnail,
    duration: v.seconds || 0,
    author: v.author?.name || '',
    views: v.views || 0
  }));
}

// Tercer respaldo: instancias publicas de Invidious (frontend alterno de
// YouTube con API de busqueda propia). Se prueban varias por si alguna
// esta caida; no depende de scrapear youtube.com directo ni de DVYER.
const INSTANCIAS_INVIDIOUS = [
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.flokinet.to'
];

async function buscarConInvidious(query, limit) {
  let ultimoError;

  for (const instancia of INSTANCIAS_INVIDIOUS) {
    try {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), 6000);

      const res = await fetch(
        `${instancia}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { signal: controlador.signal }
      );
      clearTimeout(temporizador);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error('Sin resultados');

      return data.slice(0, limit).map(v => ({
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        title: v.title || '',
        thumbnail: v.videoThumbnails?.[0]?.url || '',
        duration: v.lengthSeconds || 0,
        author: v.author || '',
        views: v.viewCount || 0
      }));
    } catch (err) {
      ultimoError = err;
      // sigue con la siguiente instancia
    }
  }

  throw ultimoError || new Error('Todas las instancias de Invidious fallaron.');
}

module.exports = {
  name: 'ytsearch',
  category: 'download',
  description: 'Busca videos en YouTube (ej: .ytsearch gatos graciosos)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const query = limpiarTexto(texto.slice((prefix + 'ytsearch ').length));

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}ytsearch <busqueda>` });
    }

    let videos = [];
    let errorApiKey = null;

    try {
      videos = await buscarConLibreria(query, 5);
    } catch (err) {
      console.warn('[ytsearch] yt-search fallo, probando API DVYER de respaldo. Detalle:', err.message);
    }

    if (!videos.length) {
      try {
        videos = await buscarYoutubeVarios(query, 5);
      } catch (err) {
        if (err.code === 'NO_API_KEY') errorApiKey = err.message;
        console.warn('[ytsearch] API DVYER tambien fallo, probando Invidious. Detalle:', err.message);
      }
    }

    if (!videos.length) {
      try {
        videos = await buscarConInvidious(query, 5);
      } catch (err) {
        console.error('[ytsearch]', err);
        return sock.sendMessage(jid, {
          text: errorApiKey || 'No se pudo buscar en YouTube ahora mismo (fallaron los 3 metodos disponibles). Intenta en un rato.'
        });
      }
    }

    if (!videos.length) {
      return sock.sendMessage(jid, { text: 'No se encontraron resultados.' });
    }

    guardarBusqueda(jid, videos);

    const acortar = (t) => (t.length > 55 ? t.slice(0, 52) + '...' : t);

    // 1) Intento principal: carrusel deslizable de verdad, construido a mano con
    // el .proto real de WhatsApp (Message.InteractiveMessage.CarouselMessage).
    // No es un formato documentado con un helper oficial en Baileys, pero el
    // .proto SI lo define (verificado en WAProto/WAProto.proto de esta misma
    // instalacion), asi que se arma directo con las piezas oficiales:
    // generateWAMessageFromContent + prepareWAMessageMedia + relayMessage.
    // Cada tarjeta es, a su vez, otra InteractiveMessage completa (con su propio
    // header/imagen, body y botones). Si algo de esto falla (version de WhatsApp
    // que no lo soporte, error subiendo media, etc.), cae automaticamente al
    // metodo de respaldo de siempre (texto + album/miniaturas + lista).
    let carruselEnviado = false;
    try {
      const conMiniaturaParaCarrusel = videos
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.thumbnail);

      if (conMiniaturaParaCarrusel.length >= 2) {
        const tarjetas = [];

        for (const { v, i } of conMiniaturaParaCarrusel) {
          const contenidoImagen = await prepareWAMessageMedia(
            { image: { url: v.thumbnail } },
            { upload: sock.waUploadToServer }
          );

          tarjetas.push({
            header: {
              title: acortar(v.title),
              hasMediaAttachment: true,
              imageMessage: contenidoImagen.imageMessage
            },
            body: {
              text: `${v.author || 'Desconocido'} • ${formatearDuracion(v.duration)} • ${formatearVistas(v.views)} vistas`
            },
            footer: { text: `Resultado ${i + 1} de ${videos.length}` },
            nativeFlowMessage: {
              buttons: [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 Descargar MP3', id: `${prefix}ytmp3 ${i + 1}` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 Descargar MP4', id: `${prefix}ytmp4 ${i + 1}` }) }
              ]
            }
          });
        }

        const miJid = sock.user?.id || sock.authState?.creds?.me?.id;

        const mensajeCarrusel = generateWAMessageFromContent(jid, {
          interactiveMessage: {
            body: { text: `🌸 Resultados para: *${query}*` },
            footer: { text: 'ALEPANDA BOT' },
            carouselMessage: {
              cards: tarjetas,
              messageVersion: 2
            }
          }
        }, { userJid: miJid, quoted: msg });

        await sock.relayMessage(jid, mensajeCarrusel.message, { messageId: mensajeCarrusel.key.id });

        carruselEnviado = true;
        console.log('[ytsearch] Carrusel deslizable (armado a mano) enviado correctamente.');
      }
    } catch (err) {
      console.warn('[ytsearch] El carrusel a mano fallo, se usa el metodo de respaldo. Detalle:', err.message);
    }

    if (carruselEnviado) return;

    // 2) Respaldo de siempre (si el carrusel no se pudo armar/enviar): texto con
    // la lista + miniaturas agrupadas en album (o sueltas) + lista interactiva.
    const listado = videos.map((v, i) =>
      `*${i + 1}. ${v.title}*\n` +
      `Canal: ${v.author || 'Desconocido'} | Duracion: ${formatearDuracion(v.duration)} | Vistas: ${formatearVistas(v.views)}\n` +
      `⬇️ ${prefix}ytmp3 ${i + 1}  |  ${prefix}ytmp4 ${i + 1}`
    ).join('\n\n');

    await sock.sendMessage(jid, {
      text: `🌸 Resultados para: *${query}*\n\n${listado}`
    });

    // Miniaturas agrupadas en un solo mensaje tipo "album" (igual que cuando mandas
    // varias fotos juntas manualmente en WhatsApp). @whiskeysockets/baileys NO trae
    // un helper "sendAlbumMessage" (es una funcion que solo agregaron algunos forks
    // comunitarios, y de hecho el soporte de albumes sigue como issue abierto sin
    // resolver en el repo oficial: github.com/WhiskeySockets/Baileys/issues/775).
    //
    // Aun asi, se puede construir a mano con las piezas que SI son oficiales:
    // 1) Se manda un mensaje "albumMessage" vacio, avisando cuantas imagenes vienen.
    // 2) Cada imagen se manda por separado, pero enlazada a ese mensaje via
    //    messageContextInfo.messageAssociation (asociandola como "hija" del album).
    // Esto replica lo que hacen los forks que si lo soportan, pero es un formato
    // NO documentado oficialmente por WhatsApp/Baileys, asi que no hay garantia total
    // de que WhatsApp lo renderice igual en todos los clientes/versiones. Si falla,
    // cae automaticamente al metodo de siempre (miniaturas sueltas).
    const conMiniatura = videos.filter(v => v.thumbnail);

    let albumEnviado = false;
    if (conMiniatura.length > 1) {
      try {
        const miJid = sock.user?.id || sock.authState?.creds?.me?.id;

        const mensajeAlbum = generateWAMessageFromContent(jid, {
          albumMessage: {
            expectedImageCount: conMiniatura.length,
            expectedVideoCount: 0
          }
        }, { userJid: miJid, quoted: msg });

        await sock.relayMessage(jid, mensajeAlbum.message, { messageId: mensajeAlbum.key.id });

        for (const v of conMiniatura) {
          const mensajeImagen = await generateWAMessage(jid, {
            image: { url: v.thumbnail },
            caption: `${videos.indexOf(v) + 1}`
          }, { upload: sock.waUploadToServer });

          mensajeImagen.message.messageContextInfo = {
            messageAssociation: { associationType: 1, parentMessageKey: mensajeAlbum.key }
          };

          await sock.relayMessage(jid, mensajeImagen.message, { messageId: mensajeImagen.key.id });
        }

        albumEnviado = true;
        console.log('[ytsearch] Album armado a mano y enviado.');
      } catch (err) {
        console.warn('[ytsearch] El album armado a mano fallo, se manda cada miniatura por separado. Detalle:', err.message);
      }
    }

    if (!albumEnviado) {
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        try {
          if (v.thumbnail) {
            await sock.sendMessage(jid, { image: { url: v.thumbnail }, caption: `${i + 1}` });
          }
          console.log(`[ytsearch] resultado ${i + 1}/${videos.length} enviado`);
        } catch (err) {
          console.error(`[ytsearch] error enviando miniatura ${i + 1}/${videos.length}:`, err.message);
        }
      }
    }

    try {
      await sock.sendMessage(jid, {
        text: 'Tambien puedes elegir aqui abajo 👇',
        footer: 'ALEPANDA BOT',
        title: 'Descargar un resultado',
        buttonText: 'Ver opciones',
        sections: [
          {
            title: '🎵 Descargar audio (MP3)',
            rows: videos.map((v, i) => ({
              title: `${i + 1}. ${acortar(v.title)}`,
              rowId: `${prefix}ytmp3 ${i + 1}`
            }))
          },
          {
            title: '🎬 Descargar video (MP4)',
            rows: videos.map((v, i) => ({
              title: `${i + 1}. ${acortar(v.title)}`,
              rowId: `${prefix}ytmp4 ${i + 1}`
            }))
          }
        ]
      });
    } catch (err) {
      console.warn('[ytsearch] la lista interactiva no se pudo enviar (el cliente de quien la recibe puede no soportarla):', err.message);
    }
  }
};

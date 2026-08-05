const { buscarYoutubeVarios, limpiarTexto } = require('../../../lib/dvyerapi');
const { guardarBusqueda } = require('../../../lib/busquedas');
const { generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia, proto } = require('@whiskeysockets/baileys');

// Se pide un "pool" mas grande de resultados de los que se muestran, y de
// ahi se elige un subconjunto al azar cada vez. Asi, si repites el mismo
// .ytsearch, no siempre salen exactamente los mismos videos en el mismo orden.
const TAMANO_POOL = 20;
const CANTIDAD_A_MOSTRAR = 8;

function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

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

const TIMEOUT_MEDIA_MS = 12000;
function conTimeout(promesa, ms, mensajeError) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensajeError)), ms))
  ]);
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

// === INTENTO DE CARRUSEL (fork Edward-oficial/bails) ===
// NOTA: en la version anterior de este archivo, con la libreria oficial
// @whiskeysockets/baileys, se probo un carrusel similar y se quito porque
// Baileys reportaba el envio como exitoso pero WhatsApp nunca lo entregaba
// en NINGUN cliente. Este bloque prueba lo mismo pero con el fork
// Edward-oficial/bails, que trae su propia implementacion de
// proto.Message.InteractiveMessage.CarouselMessage. No hay garantia de que
// funcione mejor -- es un experimento. Por eso NO se quita el flujo de
// siempre (texto + miniaturas + botones) despues de esto: si el carrusel
// no se ve, el resto del mensaje sigue llegando igual que antes.
async function intentarCarrusel(sock, jid, msg, query, videos, prefix) {
  if (!proto?.Message?.InteractiveMessage?.CarouselMessage) {
    console.warn('[ytsearch] Este fork de Baileys no expone CarouselMessage, se omite el intento de carrusel.');
    return false;
  }

  try {
    const conMiniatura = videos.filter(v => v.thumbnail);
    if (!conMiniatura.length) return false;

    const cards = await Promise.all(conMiniatura.map(async (v, i) => {
      let img = null;
      try {
        img = await conTimeout(
          prepareWAMessageMedia({ image: { url: v.thumbnail } }, { upload: sock.waUploadToServer }),
          TIMEOUT_MEDIA_MS,
          `Timeout preparando miniatura de la tarjeta ${i + 1}`
        );
      } catch (e) {
        console.warn(`[ytsearch][carrusel] no se pudo preparar la miniatura ${i + 1}:`, e.message);
      }

      return {
        header: proto.Message.InteractiveMessage.Header.fromObject({
          title: v.title.length > 60 ? v.title.slice(0, 57) + '...' : v.title,
          hasMediaAttachment: !!img,
          imageMessage: img?.imageMessage || null
        }),
        body: proto.Message.InteractiveMessage.Body.fromObject({
          text: `Canal: ${v.author || 'Desconocido'}\nDuracion: ${formatearDuracion(v.duration)} | Vistas: ${formatearVistas(v.views)}`
        }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
          buttons: [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 MP3', id: `${prefix}ytmp3 ${i + 1}` }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 MP4', id: `${prefix}ytmp4 ${i + 1}` }) }
          ]
        })
      };
    }));

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.fromObject({
        text: `🌸 Resultados para: *${query}* (desliza para ver mas)`
      }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: 'ALEPANDA BOT' }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        title: 'YouTube',
        subtitle: query,
        hasMediaAttachment: false
      }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({ cards })
    });

    const contenido = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage
        }
      }
    });

    const mensajeCarrusel = generateWAMessageFromContent(jid, contenido, { quoted: msg });
    await sock.relayMessage(jid, mensajeCarrusel.message, { messageId: mensajeCarrusel.key.id });

    console.log('[ytsearch] Carrusel enviado (sin error de Baileys -- revisa manualmente si se vio bien en el telefono).');
    return true;
  } catch (err) {
    console.warn('[ytsearch] El intento de carrusel fallo con error real:', err.message);
    return false;
  }
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
      videos = await buscarConLibreria(query, TAMANO_POOL);
    } catch (err) {
      console.warn('[ytsearch] yt-search fallo, probando API DVYER de respaldo. Detalle:', err.message);
    }

    if (!videos.length) {
      try {
        videos = await buscarYoutubeVarios(query, TAMANO_POOL);
      } catch (err) {
        if (err.code === 'NO_API_KEY') errorApiKey = err.message;
        console.warn('[ytsearch] API DVYER tambien fallo, probando Invidious. Detalle:', err.message);
      }
    }

    if (!videos.length) {
      try {
        videos = await buscarConInvidious(query, TAMANO_POOL);
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

    videos = mezclarArray(videos).slice(0, CANTIDAD_A_MOSTRAR);

    guardarBusqueda(jid, videos);

    // Intento experimental de carrusel con el fork Edward-oficial/bails.
    // No bloquea ni reemplaza el resto del flujo (ver nota arriba de la funcion).
    const carruselEnviado = await intentarCarrusel(sock, jid, msg, query, videos, prefix);
    if (carruselEnviado) return;

    const acortar = (t) => (t.length > 55 ? t.slice(0, 52) + '...' : t);

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
          const mensajeImagen = await conTimeout(
            generateWAMessage(jid, {
              image: { url: v.thumbnail },
              caption: `${videos.indexOf(v) + 1}`
            }, { upload: sock.waUploadToServer }),
            TIMEOUT_MEDIA_MS,
            `Timeout preparando la miniatura ${videos.indexOf(v) + 1} del album`
          );

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

    // Botones nativos reales de descarga (MP3/MP4) por resultado.
    // La lista/botones normales de Baileys (sock.sendMessage con "sections" o
    // "buttons") estan rotos en la libreria oficial actual: le faltan unos
    // "nodos binarios" internos que WhatsApp exige para que se vean. En vez de
    // cambiar de libreria entera (riesgo alto, ver conversacion), usamos
    // baileys_helper: un paquete pequeño y ya revisado que SOLO agrega esa
    // pieza faltante, sin tocar ni reemplazar la libreria oficial.
    //
    // Limitamos a los primeros 5 resultados (10 botones) para no saturar el
    // mensaje; el resto se puede pedir igual escribiendo .ytmp3/.ytmp4 <numero>.
    try {
      const { sendButtons } = require('baileys_helper');
      const limite = Math.min(videos.length, 5);
      const botones = [];
      for (let i = 0; i < limite; i++) {
        botones.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `🎵 MP3 #${i + 1}`, id: `${prefix}ytmp3 ${i + 1}` }) });
        botones.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: `🎬 MP4 #${i + 1}`, id: `${prefix}ytmp4 ${i + 1}` }) });
      }

      await sendButtons(sock, jid, {
        text: `Toca un boton para descargar (resultados 1-${limite}).${videos.length > limite ? `\nPara los demas, escribe ${prefix}ytmp3 <numero> o ${prefix}ytmp4 <numero>.` : ''}`,
        footer: 'ALEPANDA BOT',
        buttons: botones
      });

      console.log('[ytsearch] Botones nativos (baileys_helper) enviados.');
    } catch (err) {
      console.warn('[ytsearch] No se pudieron mandar los botones nativos, usa los comandos .ytmp3/.ytmp4 manuales. Detalle:', err.message);
      await sock.sendMessage(jid, {
        text: `Para descargar, escribe ${prefix}ytmp3 <numero> o ${prefix}ytmp4 <numero> segun el resultado que quieras.`
      });
    }
  }
};

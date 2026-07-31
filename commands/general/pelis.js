const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const {
  listarPeliculas,
  obtenerPelicula,
  eliminarPelicula,
  purgarVencidas,
  formatearTamano,
  DIAS_VENCIMIENTO_DEFAULT
} = require('../../lib/pelis');
const { leerConfig } = require('../../lib/config');
const { caja } = require('../../lib/estilo');

module.exports = {
  name: 'pelis',
  aliases: ['peliculas', 'pelicula'],
  category: 'general',
  description: 'Lista el catalogo de peliculas o pide una por numero. Uso: .pelis [numero]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();

    if (!config.grupoPelis) {
      return sock.sendMessage(jid, {
        text: caja(['Aun no hay un grupo de peliculas configurado.'], { titulo: 'PELIS', estilo: 'gamer' })
      });
    }

    const numeroPedido = texto.trim().split(/\s+/)[1];

    // --- Sin numero: mostrar el catalogo (purgando vencidas por fecha primero) ---
    if (!numeroPedido) {
      purgarVencidas();
      const peliculas = listarPeliculas();

      if (peliculas.length === 0) {
        return sock.sendMessage(jid, {
          text: caja(['El catalogo esta vacio por ahora.'], { titulo: '🎬 PELIS', estilo: 'gamer' })
        });
      }

      const lineas = peliculas
        .sort((a, b) => a.numero - b.numero)
        .map(p => `*${p.numero}.* ${p.nombre} (${formatearTamano(p.tamano)})`);
      lineas.push('', `Pide una con: ${prefix}pelis <numero>`);

      return sock.sendMessage(jid, {
        text: caja(lineas, { titulo: `🎬 CATALOGO (${peliculas.length})`, estilo: 'gamer' })
      });
    }

    // --- Con numero: entregar esa pelicula ---
    const pelicula = obtenerPelicula(numeroPedido);
    if (!pelicula) {
      return sock.sendMessage(jid, {
        text: caja([`No encontre la pelicula #${numeroPedido}.`, `Usa "${prefix}pelis" para ver el catalogo.`], { titulo: 'PELIS', estilo: 'gamer' })
      });
    }

    await sock.sendMessage(jid, {
      text: caja([`Descargando *${pelicula.nombre}*...`, 'Esto puede tardar segun el peso del archivo.'], { titulo: '🎬 UN MOMENTO', estilo: 'gamer' })
    }, { quoted: msg });

    try {
      const mensajeFalso = {
        key: pelicula.key,
        message: { videoMessage: pelicula.videoMessage }
      };
      const buffer = await downloadMediaMessage(mensajeFalso, 'buffer', {});

      await sock.sendMessage(jid, {
        video: buffer,
        mimetype: pelicula.mimetype || 'video/mp4',
        caption: `🎬 ${pelicula.nombre}`,
        fileName: pelicula.nombre
      }, { quoted: msg });
    } catch (err) {
      console.warn(`[pelis] la pelicula #${pelicula.numero} ya no se pudo descargar, la elimino del catalogo:`, err.message);
      eliminarPelicula(pelicula.numero);
      await sock.sendMessage(jid, {
        text: caja(
          [`La pelicula #${pelicula.numero} (${pelicula.nombre}) ya expiro en WhatsApp.`, 'La quite del catalogo automaticamente.'],
          { titulo: 'PELIS', estilo: 'gamer' }
        )
      });
    }
  }
};

const { obtenerBusqueda } = require('../../../lib/busquedas');

function formatearDuracion(segundos = 0) {
  const sec = Number(segundos) || 0;
  const min = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${min}:${s.toString().padStart(2, '0')}`;
}

// Paso intermedio de .ytsearch: al tocar el boton de una cancion, este
// comando manda un segundo mensaje con 2 botones PLANOS (MP3/MP4) solo
// para esa cancion. Se hace en 2 pasos y con botones planos (sin listas
// ni secciones anidadas) porque eso es lo que mejor se ve en iPhone.
module.exports = {
  name: 'ytelegir',
  category: 'download',
  description: 'Uso interno: paso intermedio de .ytsearch para elegir formato',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const numero = texto.trim().split(/\s+/)[1];
    const video = numero && obtenerBusqueda(jid, numero);

    if (!video) {
      return sock.sendMessage(jid, {
        text: `Esa busqueda ya expiro o el numero no es valido. Usa ${prefix}ytsearch de nuevo.`
      }, { quoted: msg });
    }

    const caption = `*${numero}. ${video.title}*\n` +
      `${video.author || 'Desconocido'} • ${formatearDuracion(video.duration)}\n\n` +
      `Elige el formato:`;

    const botones = [
      { text: '🎵 MP3', id: `${prefix}ytmp3 ${numero}` },
      { text: '🎬 MP4', id: `${prefix}ytmp4 ${numero}` }
    ];

    try {
      if (video.thumbnail) {
        await sock.sendMessage(jid, { image: { url: video.thumbnail }, caption, footer: 'ALEPANDA BOT', buttons: botones });
      } else {
        await sock.sendMessage(jid, { text: caption, footer: 'ALEPANDA BOT', buttons: botones });
      }
    } catch (err) {
      console.warn('[ytelegir] fallaron los botones, mando en texto plano:', err.message);
      await sock.sendMessage(jid, {
        text: `${caption}\n\n${prefix}ytmp3 ${numero}  |  ${prefix}ytmp4 ${numero}`
      });
    }
  }
};

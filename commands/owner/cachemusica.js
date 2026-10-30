const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja, exito, advertencia } = require('../../lib/estilo');
const ytd = require('../../lib/ytdirecto');

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function soloOwner(sock, jid, msg, accion) {
  const autorizado = await esOwnerBot(sock, leerConfig(), msg);
  if (!autorizado) {
    await sock.sendMessage(jid, {
      text: advertencia(`Solo un owner del bot puede ${accion}.`, { titulo: 'SIN PERMISOS' })
    }, { quoted: msg });
  }
  return autorizado;
}

const estado = {
  name: 'cachemusica',
  category: 'owner',
  description: 'Muestra cuantas canciones/videos hay guardados en la cache de descargas y cuanto espacio ocupan (solo owner)',
  execute: async (sock, jid, msg, { prefix }) => {
    if (!(await soloOwner(sock, jid, msg, 'ver la cache de musica'))) return;
    const e = ytd.cacheEstado();
    await sock.sendMessage(jid, {
      text: caja([
        `🎵 Canciones (mp3): *${e.canciones}*`,
        `🎬 Videos (mp4): *${e.videos}*`,
        `💾 Espacio usado: *${mb(e.bytes)}* de ${e.maxMB} MB`,
        e.llena ? '🔴 Cache llena: ya no guarda canciones nuevas, pero sigue mandando las guardadas' : '🟢 Hay espacio: sigue guardando lo que se descargue',
        `🔎 Busquedas recordadas: *${e.busquedas}*`,
        '',
        `Para borrar todo y empezar de cero: *${prefix}limpiarcache*`
      ], { titulo: 'CACHE DE MUSICA' })
    }, { quoted: msg });
  }
};

const limpiar = {
  name: 'limpiarcache',
  aliases: ['borrarcache', 'vaciarcache'],
  category: 'owner',
  description: 'Borra TODAS las canciones, videos y busquedas guardados en la cache de descargas y empieza desde cero (solo owner)',
  execute: async (sock, jid, msg) => {
    if (!(await soloOwner(sock, jid, msg, 'borrar la cache de musica'))) return;
    const r = ytd.cacheBorrarTodo();
    await sock.sendMessage(jid, {
      text: exito(`Se borraron *${r.archivos}* archivo(s) y se liberaron *${mb(r.bytes)}*. La cache empieza desde cero; lo que pidan de nuevo se volvera a descargar y a guardar.`, { titulo: 'CACHE VACIADA' })
    }, { quoted: msg });
  }
};

module.exports = [estado, limpiar];

// lib/limpiezaTemp.js
// Red de seguridad para archivos temporales. Cada comando que usa ffmpeg
// (sticker, stickervideo, toaudio, etc.) ya deberia borrar sus propios
// archivos al terminar, pero si un comando truena a medio proceso (por
// ejemplo si ffmpeg falla o el bot se reinicia de golpe), esos archivos se
// quedan tirados en la carpeta temporal del sistema para siempre.
//
// Esto barre esa carpeta cada cierto tiempo y borra SOLO los archivos que:
//   1) Coinciden con los prefijos que este bot mismo usa (nunca toca archivos
//      de otros programas que compartan la misma carpeta temporal del SO).
//   2) Tienen mas de cierto tiempo de antiguedad (para no borrar uno que
//      otro comando esta usando ahora mismo, a medio procesar).

const fs = require('fs');
const os = require('os');
const path = require('path');

// Prefijos reales usados en el proyecto (ver: sticker.js, stickervideo.js,
// stickerneon.js, stickertexto.js, toaudio.js, emojimix.js, brat.js, qc.js,
// animeaudio.js, animevoz.js, shazam.js, play.js, esia.js, animereact.js).
const PREFIJOS_DEL_BOT = [
  'sticker_in_', 'sticker_out_',
  'stickvid_in_', 'stickvid_out_',
  'stickneon_', 'stickertexto_',
  'toaudio_in_', 'toaudio_out_',
  'emojimix_', 'brat_', 'qc_',
  'animeaudio_', 'animevoz_', 'animereact_',
  'shazam_', 'play_', 'esia_'
];

const EDAD_MINIMA_MS = 10 * 60 * 1000; // no tocar nada con menos de 10 min de antiguedad

function limpiarTemporales() {
  const tmpDir = os.tmpdir();
  let borrados = 0;
  let liberadoBytes = 0;

  let archivos;
  try {
    archivos = fs.readdirSync(tmpDir);
  } catch (e) {
    return { borrados: 0, liberadoBytes: 0 };
  }

  const ahora = Date.now();

  for (const nombre of archivos) {
    if (!PREFIJOS_DEL_BOT.some((p) => nombre.startsWith(p))) continue;

    const rutaCompleta = path.join(tmpDir, nombre);
    try {
      const stat = fs.statSync(rutaCompleta);
      if (!stat.isFile()) continue;
      if ((ahora - stat.mtimeMs) < EDAD_MINIMA_MS) continue;

      fs.unlinkSync(rutaCompleta);
      borrados++;
      liberadoBytes += stat.size;
    } catch (e) {
      // El archivo pudo haber sido borrado por su propio comando justo en
      // este momento (carrera normal), o no se pudo leer/borrar. Se ignora.
    }
  }

  return { borrados, liberadoBytes };
}

module.exports = { limpiarTemporales };

// Genera un avatar unico y consistente por personaje usando DiceBear
// (libreria de avatares open-source, con licencia libre, sin personajes con copyright).
// El mismo nombre siempre produce el mismo avatar (es determinista por "seed").
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const ESTILO = 'adventurer';

function urlAvatar(seed) {
  return `https://api.dicebear.com/9.x/${ESTILO}/png?seed=${encodeURIComponent(seed)}&size=512`;
}

async function obtenerAvatarPersonaje(nombre) {
  const url = urlAvatar(nombre);
  const { stdout } = await execFileAsync('curl', [
    '-sL',
    '--max-time', '15',
    url
  ], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 20 });

  if (!stdout || !stdout.length) throw new Error('No se pudo descargar el avatar (buffer vacio)');
  return stdout;
}

module.exports = { obtenerAvatarPersonaje, urlAvatar };

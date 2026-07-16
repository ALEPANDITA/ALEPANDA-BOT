// Trae una imagen aleatoria de anime desde nekos.best.
// Cloudflare bloquea las peticiones hechas con fetch/axios de node en este entorno,
// pero curl si funciona, asi que usamos curl tanto para pedir los datos (JSON)
// como para descargar el archivo de imagen en si (como buffer), evitando que
// Baileys/axios intente descargar la URL por su cuenta y reciba otro 403.
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function obtenerImagenAnime(categoria) {
  const { stdout } = await execFileAsync('curl', [
    '-s',
    '--max-time', '10',
    `https://nekos.best/api/v2/${categoria}`
  ]);

  const data = JSON.parse(stdout);
  const resultado = data?.results?.[0];
  if (!resultado?.url) throw new Error('Respuesta vacia de nekos.best');
  return resultado;
}

async function descargarImagenBuffer(url) {
  const { stdout } = await execFileAsync('curl', [
    '-sL',
    '--max-time', '15',
    url
  ], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 20 });

  if (!stdout || !stdout.length) throw new Error('No se pudo descargar la imagen (buffer vacio)');
  return stdout;
}

module.exports = { obtenerImagenAnime, descargarImagenBuffer };

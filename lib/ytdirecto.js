// lib/ytdirecto.js
// Busqueda y descarga de YouTube DIRECTA con yt-dlp (sin API externa).
// Requiere en el servidor: yt-dlp y ffmpeg. Opcional: cookies.txt en la raiz del bot.
// Seguridad: se usa execFile (sin shell) y la URL va despues de "--", asi que
// nada de lo que escriba un usuario puede ejecutarse como comando.

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const COOKIES = path.join(__dirname, '..', 'cookies.txt');

const MAX_DURACION_SEG = 60 * 60;       // no baja videos de mas de 60 min ni directos
const MAX_MB = 95;                      // limite de tamaño por archivo
const ALTURA_VIDEO = 720;               // calidad maxima de video (para no pasarse del limite de WhatsApp)
const TIMEOUT_BUSQUEDA_MS = 30 * 1000;
const TIMEOUT_DESCARGA_MS = 4 * 60 * 1000;
const MAX_SIMULTANEAS = 2;              // descargas a la vez (cuida la RAM del VPS)

// ---------- Cola simple para no saturar el servidor ----------
let activas = 0;
const espera = [];
function tomarTurno() {
  return new Promise((resolve) => {
    const entrar = () => { activas++; resolve(); };
    if (activas < MAX_SIMULTANEAS) entrar(); else espera.push(entrar);
  });
}
function soltarTurno() {
  activas--;
  const siguiente = espera.shift();
  if (siguiente) siguiente();
}

// ---------- Utilidades ----------
function urlYoutubeValida(texto) {
  try {
    const u = new URL(String(texto || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtu.be') return u.toString();
  } catch (_) {}
  return null;
}

let soportaJsRuntimes = null;
function detectarJsRuntimes() {
  if (soportaJsRuntimes !== null) return Promise.resolve(soportaJsRuntimes);
  return new Promise((resolve) => {
    execFile(YTDLP, ['--help'], { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }, (err, out) => {
      soportaJsRuntimes = !err && /--js-runtimes/.test(out || '');
      resolve(soportaJsRuntimes);
    });
  });
}

async function argsBase() {
  const a = ['--ignore-config', '--no-warnings', '--no-playlist', '--no-progress', '--no-colors'];
  if (fs.existsSync(COOKIES)) a.push('--cookies', COOKIES);
  if (await detectarJsRuntimes()) a.push('--js-runtimes', 'node'); // YouTube nuevo necesita un runtime de JS
  return a;
}

function ejecutar(args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { timeout, killSignal: 'SIGKILL', maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') {
          const e = new Error('yt-dlp no esta instalado en el servidor.');
          e.definitivo = false;
          return reject(e);
        }
        if (err.killed || err.signal === 'SIGKILL') return reject(new Error('Se tardo demasiado y se cancelo.'));
        return reject(traducirError(String(stderr || err.message)));
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function traducirError(txt) {
  const t = txt.toLowerCase();
  let msg;
  if (/sign in to confirm|not a bot|confirm you.re not a bot/.test(t)) {
    msg = 'YouTube bloqueo la IP del servidor (pide verificar que no eres un bot). Hace falta un archivo cookies.txt.';
  } else if (/private video|video unavailable|this video is not available|has been removed/.test(t)) {
    msg = 'Ese video no esta disponible (privado, borrado o bloqueado en tu region).';
  } else if (/age|confirm your age|inappropriate/.test(t) && /sign in|login/.test(t)) {
    msg = 'Ese video tiene restriccion de edad y necesita cookies.txt para bajarse.';
  } else if (/requested format is not available|no video formats/.test(t)) {
    msg = 'No hay un formato disponible para ese video.';
  } else if (/ffmpeg|ffprobe/.test(t) && /not found|not installed|no such file/.test(t)) {
    msg = 'Falta ffmpeg en el servidor.';
  } else if (/http error 429|too many requests/.test(t)) {
    msg = 'YouTube esta limitando las peticiones, intenta en unos minutos.';
  } else {
    msg = 'yt-dlp fallo: ' + txt.split('\n').filter(Boolean).slice(-1)[0].slice(0, 200);
  }
  return new Error(msg);
}

// ---------- Busqueda ----------
async function buscar(query, limit = 5) {
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return [];
  const n = Math.max(1, Math.min(Number(limit) || 5, 25));
  const args = [...(await argsBase()), '--flat-playlist', '--dump-json', '--', `ytsearch${n}:${q}`];
  const { stdout } = await ejecutar(args, TIMEOUT_BUSQUEDA_MS);

  const resultados = [];
  for (const linea of stdout.split('\n')) {
    if (!linea.trim()) continue;
    let v;
    try { v = JSON.parse(linea); } catch (_) { continue; }
    if (!v.id) continue;
    resultados.push({
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: String(v.title || '').replace(/\s+/g, ' ').trim(),
      thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      duration: Number(v.duration || 0),
      author: String(v.channel || v.uploader || '').trim(),
      views: Number(v.view_count || 0)
    });
  }
  return resultados;
}

// ---------- Descarga ----------
// Devuelve el mismo formato que la API vieja. En "remoteUrl" va la RUTA del
// archivo local ya descargado (dvyerapi.descargarBuffer / descargarArchivo la reconocen).
async function descargar(videoUrl, formato) {
  const url = urlYoutubeValida(videoUrl);
  if (!url) { const e = new Error('Solo se pueden descargar links de YouTube.'); e.definitivo = true; throw e; }

  const base = path.join(os.tmpdir(), `play_ytd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const ext = formato === 'mp4' ? 'mp4' : 'mp3';

  const filtro = `!is_live & duration<=${MAX_DURACION_SEG}`;
  const args = [...(await argsBase()),
    '--match-filter', filtro,
    '--max-filesize', `${MAX_MB}M`,
    '-o', `${base}.%(ext)s`,
    '--no-simulate',
    '--print', 'after_move:%(title)s\t%(uploader)s\t%(duration)s\t%(id)s'
  ];
  if (ext === 'mp3') {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '128K');
  } else {
    args.push('-f', `bv*[height<=${ALTURA_VIDEO}][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=${ALTURA_VIDEO}][ext=mp4]/b[height<=${ALTURA_VIDEO}]/b`,
      '--merge-output-format', 'mp4');
  }
  args.push('--', url);

  await tomarTurno();
  try {
    const { stdout } = await ejecutar(args, TIMEOUT_DESCARGA_MS);

    const archivo = fs.readdirSync(os.tmpdir())
      .filter((f) => f.startsWith(path.basename(base) + '.') && f.endsWith('.' + ext))
      .map((f) => path.join(os.tmpdir(), f))[0];

    if (!archivo || fs.statSync(archivo).size === 0) {
      const e = new Error(`No se pudo bajar: el video dura mas de ${MAX_DURACION_SEG / 60} min, es un directo o pesa mas de ${MAX_MB}MB.`);
      e.definitivo = true;
      throw e;
    }

    const [title, uploader, duration, id] = (stdout.trim().split('\n').pop() || '').split('\t');
    return {
      remoteUrl: archivo,
      title: (title || '').trim(),
      thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
      author: (uploader || '').trim(),
      duration: Number(duration || 0),
      fileName: (title || 'descarga').trim()
    };
  } catch (err) {
    limpiarRestos(base);
    throw err;
  } finally {
    soltarTurno();
    // Quita intermedios (.webm, .m4a, .part...) que yt-dlp pudo dejar; el archivo final se conserva.
    limpiarRestos(base, ext);
  }
}

function limpiarRestos(base, conservarExt) {
  try {
    const prefijo = path.basename(base) + '.';
    for (const f of fs.readdirSync(os.tmpdir())) {
      if (!f.startsWith(prefijo)) continue;
      if (conservarExt && f.endsWith('.' + conservarExt)) continue;
      try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch (_) {}
    }
  } catch (_) {}
}

// ---------- Ayudas para dvyerapi.js ----------
function esRutaLocal(valor) {
  return typeof valor === 'string' && path.isAbsolute(valor) && path.basename(valor).startsWith('play_ytd_');
}

function leerYBorrar(ruta) {
  const buffer = fs.readFileSync(ruta);
  try { fs.unlinkSync(ruta); } catch (_) {}
  return buffer;
}

module.exports = { buscar, descargar, esRutaLocal, leerYBorrar, urlYoutubeValida };

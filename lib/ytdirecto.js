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
const CLIENTES_RESPALDO = ['tv', 'android_vr', 'web_safari', 'mweb', 'ios']; // se prueban si YouTube bloquea el cliente normal
const MAX_REINTENTOS_MS = 150 * 1000;   // tope de tiempo probando clientes
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

async function ejecutarConClientes(args, timeout, limpiar) {
  const inicio = Date.now();
  let ultimo;
  for (const cliente of [null, ...CLIENTES_RESPALDO]) {
    const i = args.indexOf('--');
    const extra = cliente ? ['--extractor-args', `youtube:player_client=${cliente}`] : [];
    try {
      const r = await ejecutar([...args.slice(0, i), ...extra, ...args.slice(i)], timeout);
      if (cliente) console.log('[ytdirecto] funciono con el cliente:', cliente);
      return r;
    } catch (err) {
      ultimo = err;
      if (!err.bloqueo || Date.now() - inicio > MAX_REINTENTOS_MS) break;
      if (limpiar) limpiar();
    }
  }
  throw ultimo;
}

function traducirError(txt) {
  const t = txt.toLowerCase();
  let msg;
  let bloqueo = false;
  if (/sign in to confirm|not a bot|confirm you.re not a bot/.test(t)) {
    msg = 'YouTube bloqueo la IP del servidor (pide verificar que no eres un bot). Hace falta un archivo cookies.txt.';
    bloqueo = true;
  } else if (/http error 403|forbidden/.test(t)) {
    msg = 'YouTube rechazo la descarga (403). Puede que haya bloqueado la IP del servidor; prueba con un cookies.txt o espera un rato.';
    bloqueo = true;
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
  const e = new Error(msg);
  e.bloqueo = bloqueo;
  return e;
}

// ---------- Cache de canciones y busquedas ----------
// Cada cancion/video que se baja se guarda en cache-musica/<id>.mp3|mp4. Si alguien
// pide lo mismo otra vez, se manda al instante sin volver a descargar de YouTube.
// Las busquedas repetidas (mismo texto) tambien se recuerdan unos dias.
const CACHE_DIR = path.join(__dirname, '..', 'cache-musica');
const CACHE_MAX_MB = Number(process.env.CACHE_MAX_MB) || 10240; // espacio maximo de la cache (10 GB). Al llenarse YA NO guarda nada nuevo, pero sigue mandando lo guardado
const CACHE_MAX_ARCHIVO_MB = 40;        // no guarda archivos mas grandes que esto
const BUSQUEDA_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const BUSQUEDA_ARCHIVO = path.join(CACHE_DIR, 'busquedas.json');
const BUSQUEDA_MAX = 500;

function idDeUrl(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, '');
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
    else id = u.searchParams.get('v') || '';
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch (_) { return null; }
}

function copiarRapido(origen, destino) {
  try { fs.linkSync(origen, destino); } catch (_) { fs.copyFileSync(origen, destino); }
}

function cacheLeer(id, ext) {
  if (!id) return null;
  try {
    const archivo = path.join(CACHE_DIR, `${id}.${ext}`);
    if (!fs.statSync(archivo).size) return null;
    const meta = JSON.parse(fs.readFileSync(archivo + '.json', 'utf8'));
    const ahora = new Date();
    try { fs.utimesSync(archivo, ahora, ahora); } catch (_) {}
    // Se entrega una copia temporal (el resto del bot la lee y la borra, la original se queda en cache)
    const copia = path.join(os.tmpdir(), `play_ytd_cache_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
    copiarRapido(archivo, copia);
    return {
      remoteUrl: copia,
      title: String(meta.title || '').trim(),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      author: String(meta.uploader || '').trim(),
      duration: Number(meta.duration || 0),
      fileName: String(meta.title || 'descarga').trim(),
      desdeCache: true
    };
  } catch (_) { return null; }
}

function cacheUsado() {
  let total = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!/\.(mp3|mp4)$/.test(f)) continue;
      try { total += fs.statSync(path.join(CACHE_DIR, f)).size; } catch (_) {}
    }
  } catch (_) {}
  return total;
}

let avisoCacheLlena = false;

function cacheGuardar(id, ext, origen, meta) {
  if (!id) return;
  try {
    const tam = fs.statSync(origen).size;
    if (!tam || tam > CACHE_MAX_ARCHIVO_MB * 1024 * 1024) return;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    // Cache llena: no se guarda nada nuevo (lo que ya esta guardado se sigue mandando)
    if (cacheUsado() + tam > CACHE_MAX_MB * 1024 * 1024) {
      if (!avisoCacheLlena) { avisoCacheLlena = true; console.log('[cache-musica] cache llena, ya no se guardan canciones nuevas (usa .limpiarcache para vaciarla)'); }
      return;
    }
    avisoCacheLlena = false;
    const destino = path.join(CACHE_DIR, `${id}.${ext}`);
    const tmp = `${destino}.tmp${process.pid}`;
    fs.copyFileSync(origen, tmp);
    fs.renameSync(tmp, destino);
    fs.writeFileSync(destino + '.json', JSON.stringify({ ...meta, guardado: Date.now() }));
  } catch (err) {
    console.error('[cache-musica] no se pudo guardar:', err.message);
  }
}

let busquedas = null;
let busquedasPendiente = null;
function busquedasCargar() {
  if (busquedas) return busquedas;
  try { busquedas = JSON.parse(fs.readFileSync(BUSQUEDA_ARCHIVO, 'utf8')) || {}; } catch (_) { busquedas = {}; }
  return busquedas;
}
function claveBusqueda(q, n) {
  return n + '|' + q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function busquedaLeer(q, n) {
  const e = busquedasCargar()[claveBusqueda(q, n)];
  if (!e || Date.now() - e.t > BUSQUEDA_TTL_MS || !Array.isArray(e.r) || !e.r.length) return null;
  return JSON.parse(JSON.stringify(e.r));
}
function busquedaGuardar(q, n, resultados) {
  if (!resultados.length) return;
  const todas = busquedasCargar();
  todas[claveBusqueda(q, n)] = { t: Date.now(), r: resultados };
  const claves = Object.keys(todas);
  if (claves.length > BUSQUEDA_MAX) {
    claves.sort((a, b) => todas[a].t - todas[b].t).slice(0, claves.length - BUSQUEDA_MAX).forEach((k) => delete todas[k]);
  }
  if (busquedasPendiente) return;
  busquedasPendiente = setTimeout(() => {
    busquedasPendiente = null;
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(BUSQUEDA_ARCHIVO + '.tmp', JSON.stringify(todas));
      fs.renameSync(BUSQUEDA_ARCHIVO + '.tmp', BUSQUEDA_ARCHIVO);
    } catch (_) {}
  }, 5000);
  if (busquedasPendiente.unref) busquedasPendiente.unref();
}

function cacheEstado() {
  let canciones = 0, videos = 0, bytes = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!/\.(mp3|mp4)$/.test(f)) continue;
      try { bytes += fs.statSync(path.join(CACHE_DIR, f)).size; } catch (_) { continue; }
      if (f.endsWith('.mp3')) canciones++; else videos++;
    }
  } catch (_) {}
  return { canciones, videos, bytes, busquedas: Object.keys(busquedasCargar()).length, maxMB: CACHE_MAX_MB, llena: avisoCacheLlena || bytes >= CACHE_MAX_MB * 1024 * 1024 * 0.98 };
}

// Borra TODO lo guardado (canciones, videos y busquedas) y empieza desde cero.
function cacheBorrarTodo() {
  let archivos = 0, bytes = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const ruta = path.join(CACHE_DIR, f);
      try {
        const st = fs.lstatSync(ruta);
        if (!st.isFile()) continue;
        if (/\.(mp3|mp4)$/.test(f)) { archivos++; bytes += st.size; }
        fs.unlinkSync(ruta);
      } catch (_) {}
    }
  } catch (_) {}
  busquedas = {};
  avisoCacheLlena = false;
  if (busquedasPendiente) { clearTimeout(busquedasPendiente); busquedasPendiente = null; }
  return { archivos, bytes };
}

// ---------- Busqueda ----------
async function buscar(query, limit = 5) {
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return [];
  const n = Math.max(1, Math.min(Number(limit) || 5, 25));
  const guardada = busquedaLeer(q, n);
  if (guardada) return guardada;
  const args = [...(await argsBase()), '--flat-playlist', '--dump-json', '--', `ytsearch${n}:${q}`];
  const { stdout } = await ejecutarConClientes(args, TIMEOUT_BUSQUEDA_MS);

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
  busquedaGuardar(q, n, resultados);
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

  const idCache = idDeUrl(url);
  const guardada = cacheLeer(idCache, ext);
  if (guardada) return guardada;

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
    const { stdout } = await ejecutarConClientes(args, TIMEOUT_DESCARGA_MS, () => limpiarRestos(base));

    const archivo = fs.readdirSync(os.tmpdir())
      .filter((f) => f.startsWith(path.basename(base) + '.') && f.endsWith('.' + ext))
      .map((f) => path.join(os.tmpdir(), f))[0];

    if (!archivo || fs.statSync(archivo).size === 0) {
      const e = new Error(`No se pudo bajar: el video dura mas de ${MAX_DURACION_SEG / 60} min, es un directo o pesa mas de ${MAX_MB}MB.`);
      e.definitivo = true;
      throw e;
    }

    const [title, uploader, duration, id] = (stdout.trim().split('\n').pop() || '').split('\t');
    cacheGuardar(idCache || id, ext, archivo, { title: (title || '').trim(), uploader: (uploader || '').trim(), duration: Number(duration || 0) });
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

// Prueba rapida (para .apistatustest): resuelve el primer resultado de una busqueda
// y pide sus formatos de audio, SIN descargar nada.
async function probar() {
  const args = [...(await argsBase()), '--simulate', '--print', '%(title)s', '-f', 'bestaudio', '--', 'ytsearch1:musica'];
  const { stdout } = await ejecutar(args, 45 * 1000);
  return stdout.trim().split('\n')[0] || 'ok';
}

module.exports = { buscar, descargar, esRutaLocal, leerYBorrar, urlYoutubeValida, probar, cacheEstado, cacheBorrarTodo };

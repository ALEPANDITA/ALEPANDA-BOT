// lib/playgif.js
// GIF animado (mp4 en loop) para .play: el marco morado de reproductor con la portada de la cancion dentro del cuadro negro.
// El marco es la imagen assets/play/hoja.(png|jpg|webp)  (se guarda con:  .guardarhoja play).
// Lo que se anima (todo en loop perfecto, la portada se queda quieta salvo un zoom lento y un brillo que la cruza):
//   ecualizador de arriba · onda de abajo · barra de progreso · brillos de estrellas y notas · luz que recorre el borde
// Si falta el marco o algo falla, crearGifPlay devuelve null y .play manda la ficha normal (nunca se rompe el comando).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const REF = 1254;          // el marco fue medido sobre una imagen de 1254x1254; todo se escala si la tuya es de otro tamano
const SALIDA = 720;        // lado del video final (px)
const FPS = 20;
const SEGUNDOS = 3;        // duracion del loop
const N = FPS * SEGUNDOS;  // cuadros del loop

// cuadro negro donde va la portada (coordenadas del marco de 1254)
const CUADRO = { x: 134, y: 213, w: 786, h: 742, r: 30 };
// linea del borde por donde corre la luz
const BORDE = { x: 121, y: 207.5, w: 805, h: 752.5, r: 38 };

// ecualizador de arriba: 11 columnas x 7 filas de bloques
const EQ_X = [167, 199, 230, 262, 297, 328, 360, 391, 423, 454, 485];
const EQ_ANCHO = 23;
const EQ_FILAS = [[168, 188], [142, 161], [121, 138], [100, 117], [81, 98], [59, 77], [36, 55]]; // de abajo hacia arriba
const EQ_COLOR = [[124, 67, 251], [123, 67, 247], [123, 94, 251], [120, 129, 252], [128, 163, 250], [143, 202, 254], [158, 212, 252]];
const EQ_TOPE = [7, 7, 4, 3, 3, 7, 7, 7, 7, 7, 7]; // filas maximas por columna (las del medio chocarian con la estrella grande)
const FONDO_EQ = 'rgb(5,3,10)';

// onda de abajo
const ONDA = { x0: 176, x1: 862, base: 1023, alto: 46, barras: 84, region: [166, 968, 876, 1032], fondo: 'rgb(9,6,20)' };
// barra de progreso
const PROG = { x0: 138, x1: 912, y: 1062, grosor: 10, region: [124, 1040, 928, 1086], fondo: 'rgb(9,6,17)' };

// brillos que titilan: [x, y, radio, [r,g,b]]
const L = [235, 215, 255], R = [255, 150, 205], A = [150, 190, 255];
const BRILLOS = [
  [283, 77, 78, L], [100, 100, 60, A], [140, 208, 42, L], [966, 610, 66, L], [1085, 808, 48, L], [66, 825, 48, L],
  [915, 950, 44, L], [98, 922, 26, L], [1115, 28, 24, L], [955, 909, 26, L], [51, 373, 26, L], [1175, 765, 30, L],
  [630, 105, 72, R], [60, 520, 72, R], [1050, 690, 72, R], [1190, 70, 64, L], [1175, 550, 68, A]
];

let canvasLib = null;
function cargarCanvas() {
  if (!canvasLib) canvasLib = require('@napi-rs/canvas');
  return canvasLib;
}

// ---------- marco ----------
const RAIZ_ASSETS = path.join(__dirname, '..', 'assets', 'play');
function buscarMarco() {
  try {
    for (const f of fs.readdirSync(RAIZ_ASSETS)) if (/^hoja\.(png|jpe?g|webp)$/i.test(f)) return path.join(RAIZ_ASSETS, f);
  } catch (_) { /* no existe la carpeta */ }
  return null;
}
let marcoCache = { ruta: null, mtime: 0, img: null };
async function cargarMarco() {
  const ruta = buscarMarco();
  if (!ruta) return null;
  const mtime = fs.statSync(ruta).mtimeMs;
  if (marcoCache.ruta !== ruta || marcoCache.mtime !== mtime) {
    marcoCache = { ruta, mtime, img: await cargarCanvas().loadImage(ruta) };
  }
  return marcoCache.img;
}

// ---------- utilidades ----------
function semilla(texto) {
  let h = 2166136261;
  for (const c of String(texto || 'x')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function azar(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function rectRedondo(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- portada ----------
async function bajarImagen(origen) {
  if (Buffer.isBuffer(origen)) return origen;
  const res = await fetch(origen, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar la portada`);
  return Buffer.from(await res.arrayBuffer());
}

// Recorta las barras negras de arriba/abajo (las miniaturas de YouTube suelen traerlas) y devuelve { canvas, w, h }
function recortarBordesNegros(img) {
  const { createCanvas } = cargarCanvas();
  const c = createCanvas(img.width, img.height);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, img.width, img.height).data;
  const oscura = (y) => { // fila casi negra
    let max = 0;
    for (let x = 0; x < img.width; x += 4) { const o = (y * img.width + x) * 4; max = Math.max(max, d[o], d[o + 1], d[o + 2]); if (max > 28) return false; }
    return true;
  };
  let t = 0, b = img.height - 1;
  while (t < img.height / 3 && oscura(t)) t++;
  while (b > img.height * 2 / 3 && oscura(b)) b--;
  return { fuente: c, sx: 0, sy: t, sw: img.width, sh: Math.max(1, b - t + 1) };
}

// ---------- dibujo de un cuadro ----------
function dibujarCuadro(ctx, estado, i) {
  const p = i / N;                 // 0..1 (el loop vuelve a empezar sin salto)
  const { marco, portada } = estado;
  const s = SALIDA / REF;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#05030a';
  ctx.fillRect(0, 0, REF, REF);
  ctx.drawImage(marco, 0, 0, REF, REF);

  // --- portada dentro del cuadro negro, con zoom lento
  ctx.save();
  rectRedondo(ctx, CUADRO.x, CUADRO.y, CUADRO.w, CUADRO.h, CUADRO.r);
  ctx.clip();
  ctx.fillStyle = '#05030a';
  ctx.fillRect(CUADRO.x, CUADRO.y, CUADRO.w, CUADRO.h);
  if (portada) {
    const zoom = 1.02 + 0.03 * (0.5 - 0.5 * Math.cos(TAU * p));
    const ar = CUADRO.w / CUADRO.h;
    let sw = portada.sw, sh = portada.sh;
    if (sw / sh > ar) sw = sh * ar; else sh = sw / ar; // "cover": llena el cuadro recortando lo que sobre
    sw /= zoom; sh /= zoom;
    const sx = portada.sx + (portada.sw - sw) / 2, sy = portada.sy + (portada.sh - sh) / 2;
    ctx.drawImage(portada.fuente, sx, sy, sw, sh, CUADRO.x, CUADRO.y, CUADRO.w, CUADRO.h);
  }
  // brillo que cruza la portada una vez por loop
  const barrido = clamp((p - 0.15) / 0.55, 0, 1); // ocupa el 55% del loop, el resto descansa
  if (barrido > 0 && barrido < 1) {
    const cx = CUADRO.x - 200 + barrido * (CUADRO.w + 400);
    const g = ctx.createLinearGradient(cx - 120, CUADRO.y, cx + 120, CUADRO.y + CUADRO.h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CUADRO.x, CUADRO.y, CUADRO.w, CUADRO.h);
  }
  ctx.restore();

  // --- ecualizador de arriba (se tapa el dibujo original de cada bloque y se redibuja encendido o apagado)
  ctx.fillStyle = FONDO_EQ;
  for (let c = 0; c < EQ_X.length; c++) {
    // solo hasta la fila tope de cada columna: arriba de eso esta la estrella grande y no se toca
    for (let f = 0; f < EQ_TOPE[c]; f++) ctx.fillRect(EQ_X[c] - 3, EQ_FILAS[f][0] - 3, EQ_ANCHO + 6, EQ_FILAS[f][1] - EQ_FILAS[f][0] + 7);
  }
  for (let c = 0; c < EQ_X.length; c++) {
    const e = estado.eq[c];
    const v = clamp(0.5 + 0.3 * Math.sin(TAU * (e.k1 * p) + e.f1) + 0.2 * Math.sin(TAU * (e.k2 * p) + e.f2), 0, 1);
    const encendidos = Math.max(1, Math.round(1 + (EQ_TOPE[c] - 1) * v));
    for (let f = 0; f < EQ_TOPE[c]; f++) {
      const [y0, y1] = EQ_FILAS[f], col = EQ_COLOR[f];
      rectRedondo(ctx, EQ_X[c], y0, EQ_ANCHO, y1 - y0, 4);
      if (f < encendidos) {
        ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; // reflejo arriba del bloque
        ctx.fillRect(EQ_X[c] + 2, y0 + 1, EQ_ANCHO - 4, 3);
      } else {
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.10)`;
        ctx.fill();
      }
    }
  }

  // --- onda de abajo
  const [ox0, oy0, ox1, oy1] = ONDA.region;
  ctx.fillStyle = ONDA.fondo;
  ctx.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
  const gOnda = ctx.createLinearGradient(0, ONDA.base - ONDA.alto, 0, ONDA.base);
  gOnda.addColorStop(0, 'rgb(240,226,252)'); gOnda.addColorStop(0.45, 'rgb(170,130,245)'); gOnda.addColorStop(1, 'rgb(110,74,214)');
  ctx.fillStyle = gOnda;
  const paso = (ONDA.x1 - ONDA.x0) / (ONDA.barras - 1);
  for (let b = 0; b < ONDA.barras; b++) {
    const x = ONDA.x0 + b * paso, e = estado.onda[b];
    const env = 0.22 + 0.78 * Math.exp(-Math.pow((x - 520) / 250, 2));
    const v = clamp(0.4 + 0.35 * Math.sin(TAU * (e.k1 * p) + e.f1) + 0.25 * Math.sin(TAU * (e.k2 * p) + e.f2), 0.05, 1);
    const h = Math.max(3, ONDA.alto * env * v);
    ctx.fillRect(x - 1.7, ONDA.base - h, 3.4, h);
  }

  // --- barra de progreso (la bolita avanza durante el loop)
  const [px0, py0, px1, py1] = PROG.region;
  ctx.fillStyle = PROG.fondo;
  ctx.fillRect(px0, py0, px1 - px0, py1 - py0);
  const kx = PROG.x0 + 14 + p * (PROG.x1 - PROG.x0 - 28);
  const ty = PROG.y - PROG.grosor / 2;
  const gPista = ctx.createLinearGradient(PROG.x0, 0, PROG.x1, 0);
  gPista.addColorStop(0, 'rgb(86,48,150)'); gPista.addColorStop(1, 'rgb(76,48,128)');
  ctx.fillStyle = gPista;
  rectRedondo(ctx, PROG.x0, ty, PROG.x1 - PROG.x0, PROG.grosor, PROG.grosor / 2);
  ctx.fill();
  // la parte llena y la bolita se desvanecen al final del loop y reaparecen al inicio (asi no hay salto al repetirse)
  ctx.globalAlpha = clamp(Math.min(p / 0.07, (1 - p) / 0.07), 0, 1);
  const gLleno = ctx.createLinearGradient(PROG.x0, 0, kx, 0);
  gLleno.addColorStop(0, 'rgb(226,184,240)'); gLleno.addColorStop(0.7, 'rgb(233,199,249)'); gLleno.addColorStop(1, 'rgb(200,150,250)');
  ctx.fillStyle = gLleno;
  rectRedondo(ctx, PROG.x0, ty, Math.max(PROG.grosor, kx - PROG.x0), PROG.grosor, PROG.grosor / 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = 'rgba(190,140,255,0.9)'; ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgb(189,135,252)';
  ctx.beginPath(); ctx.arc(kx, PROG.y, 14, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgb(236,215,252)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(kx, PROG.y, 13, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;

  // --- brillos de estrellas y notas
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < BRILLOS.length; b++) {
    const [x, y, r, col] = BRILLOS[b], e = estado.brillos[b];
    const a = 0.06 + 0.30 * (0.5 + 0.5 * Math.sin(TAU * (e.k * p) + e.f));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // --- luz que recorre el borde del cuadro
  const perimetro = 2 * (BORDE.w + BORDE.h) - (8 - TAU) * BORDE.r;
  const largo = perimetro * 0.16;
  ctx.save();
  rectRedondo(ctx, BORDE.x, BORDE.y, BORDE.w, BORDE.h, BORDE.r);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(210,150,255,1)'; ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(235,205,255,0.85)';
  ctx.setLineDash([largo, perimetro - largo]);
  ctx.lineDashOffset = -p * perimetro;
  ctx.stroke();
  ctx.restore();
  // y un pulso suave de todo el borde
  ctx.save();
  rectRedondo(ctx, BORDE.x, BORDE.y, BORDE.w, BORDE.h, BORDE.r);
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgba(190,120,255,${0.06 + 0.14 * (0.5 + 0.5 * Math.sin(TAU * 2 * p))})`;
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- encoder (ffmpeg) con maximo 2 renders a la vez para no ahogar el VPS ----------
let activos = 0;
const espera = [];
function entrar() { return new Promise((ok) => { const go = () => { activos++; ok(); }; activos < 2 ? go() : espera.push(go); }); }
function salir() { activos--; const sig = espera.shift(); if (sig) sig(); }

function codificar(marco, portada, seed) {
  const { createCanvas } = cargarCanvas();
  const rnd = azar(seed);
  const estado = {
    marco, portada,
    eq: EQ_X.map(() => ({ k1: 1 + Math.floor(rnd() * 3), k2: 2 + Math.floor(rnd() * 3), f1: rnd() * TAU, f2: rnd() * TAU })),
    onda: Array.from({ length: ONDA.barras }, () => ({ k1: 1 + Math.floor(rnd() * 3), k2: 2 + Math.floor(rnd() * 4), f1: rnd() * TAU, f2: rnd() * TAU })),
    brillos: BRILLOS.map(() => ({ k: 1 + Math.floor(rnd() * 3), f: rnd() * TAU }))
  };
  const salida = path.join(os.tmpdir(), `play_gif_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp4`);
  const lienzo = createCanvas(SALIDA, SALIDA);
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-nostdin', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${SALIDA}x${SALIDA}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', salida
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let errTxt = '';
    ff.stderr.on('data', (d) => { errTxt = (errTxt + d).slice(-800); });
    const reloj = setTimeout(() => { ff.kill('SIGKILL'); }, 60000);
    let roto = false;
    ff.stdin.on('error', () => { roto = true; });
    ff.on('error', (e) => { clearTimeout(reloj); reject(e); });
    ff.on('close', (code) => {
      clearTimeout(reloj);
      if (code !== 0) { try { fs.unlinkSync(salida); } catch (_) { /* nada */ } return reject(new Error('ffmpeg fallo: ' + errTxt.trim().split('\n').pop())); }
      try { const buf = fs.readFileSync(salida); fs.unlinkSync(salida); resolve(buf); } catch (e) { reject(e); }
    });
    (async () => {
      try {
        for (let i = 0; i < N && !roto; i++) {
          dibujarCuadro(ctx, estado, i);
          const datos = ctx.getImageData(0, 0, SALIDA, SALIDA).data;
          const trozo = Buffer.from(datos.buffer, datos.byteOffset, datos.length);
          if (!ff.stdin.write(trozo)) await new Promise((ok) => ff.stdin.once('drain', ok));
          if (i % 10 === 9) await new Promise((ok) => setImmediate(ok)); // deja respirar al bot mientras dibuja
        }
        ff.stdin.end();
      } catch (e) { try { ff.kill('SIGKILL'); } catch (_) { /* nada */ } reject(e); }
    })();
  });
}

// ---------- cache de los ultimos GIFs (pedir la misma cancion dos veces no vuelve a dibujar) ----------
const cache = new Map();
const CACHE_MAX = 20;

// portada: URL (string) o Buffer.  clave: lo que identifica a la cancion (id de YouTube, titulo...)
// Devuelve el mp4 (Buffer) listo para mandar con { video, gifPlayback: true }, o null si no se pudo.
async function crearGifPlay({ portada, clave } = {}) {
  const llave = String(clave || portada || '');
  if (llave && cache.has(llave)) { const v = cache.get(llave); cache.delete(llave); cache.set(llave, v); return v; }
  await entrar();
  try {
    const marco = await cargarMarco();
    if (!marco) return null;
    let datosPortada = null;
    try {
      const img = await cargarCanvas().loadImage(await bajarImagen(portada));
      datosPortada = recortarBordesNegros(img);
    } catch (err) { console.warn('[playgif] sin portada, se anima solo el marco:', err.message); }
    const mp4 = await codificar(marco, datosPortada, semilla(llave));
    if (llave && datosPortada) { cache.set(llave, mp4); if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); } // sin portada no se guarda: la proxima vez se reintenta
    return mp4;
  } catch (err) {
    console.error('[playgif]', err.message);
    return null;
  } finally {
    salir();
  }
}

module.exports = { crearGifPlay, buscarMarco };

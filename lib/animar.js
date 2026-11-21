// Motor de animaciones del casino: dibuja frames con canvas y los une en un MP4 con ffmpeg.
const { createCanvas } = require('@napi-rs/canvas');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ease = {
  cubic: (t) => 1 - Math.pow(1 - t, 3),
  quart: (t) => 1 - Math.pow(1 - t, 4),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};
const lerp = (a, b, t) => a + (b - a) * t;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Solo se renderiza un video a la vez (cuida el CPU del VPS) y maximo 4 en espera
let cola = Promise.resolve();
let pendientes = 0;

function correrFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 90000 }, (err, _so, se) => (err ? reject(new Error(String(se || err).slice(-300))) : resolve()));
  });
}

// dibujar(ctx, t, i, fin): t va de 0 a 1 durante la animacion, fin = true en los cuadros finales (resultado)
function renderizarVideo({ ancho, alto, fps = 20, total, retener = 16, dibujar }) {
  if (pendientes >= 4) return Promise.reject(new Error('cola llena'));
  pendientes++;
  const tarea = async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-'));
    try {
      const canvas = createCanvas(ancho, alto);
      const ctx = canvas.getContext('2d');
      const n = total + retener;
      for (let i = 0; i < n; i++) {
        ctx.clearRect(0, 0, ancho, alto);
        const t = Math.min(1, i / Math.max(1, total - 1));
        dibujar(ctx, t, i, i >= total - 1);
        fs.writeFileSync(path.join(dir, 'f' + String(i).padStart(4, '0') + '.png'), canvas.toBuffer('image/png'));
      }
      const salida = path.join(dir, 'salida.mp4');
      const entrada = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png')];
      try {
        await correrFFmpeg([...entrada, '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '27', '-movflags', '+faststart', '-an', salida]);
      } catch (_) {
        await correrFFmpeg([...entrada, '-c:v', 'mpeg4', '-q:v', '5', '-pix_fmt', 'yuv420p', '-an', salida]);
      }
      return fs.readFileSync(salida);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      pendientes--;
    }
  };
  const p = cola.then(tarea);
  cola = p.catch(() => {});
  return p;
}

// Manda el video como gif; si algo falla, manda el resultado en texto para no perder la jugada
async function enviarAnimacion(sock, jid, msg, opciones, caption) {
  try {
    const video = await renderizarVideo(opciones);
    return await sock.sendMessage(jid, { video, gifPlayback: true, mimetype: 'video/mp4', caption }, { quoted: msg });
  } catch (err) {
    console.error('[animar]', err && err.message ? err.message : err);
    return sock.sendMessage(jid, { text: caption }, { quoted: msg });
  }
}

module.exports = { ease, lerp, rr, renderizarVideo, enviarAnimacion };

// LOGOKOALA: logos de koala ya dibujados (assets/koala/koala1.png ... koala6.png). Ya NO se generan con IA:
// el bot solo escribe tu texto en el tablero / nube / corazon de cada koala, con un estilo propio para cada uno.
//   .logokoala <texto>        -> un koala al azar        .logokoala 3 <texto>  -> el koala 3 (del 1 al 6)
//   .logokoalavideo <texto>   -> el mismo logo en video animado (zoom suave)       (igual: .logokoalavideo 3 <texto>)
// Usa @napi-rs/canvas (ya lo usa .qc) y la fuente assets/fonts/DejaVuSans-Bold.ttf.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { advertencia, exito, error: cajaError } = require('../../lib/estilo');

const CARPETA = path.join(__dirname, '..', '..', 'assets', 'koala');
const FUENTE = path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const FAMILIA = 'KoalaSans';
const ESC = 2; // las imagenes se agrandan x2 para que el texto salga nitido
const MAX_TEXTO = 30;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f]/gu;

// caja = zona vacia donde va el texto (en pixeles de la imagen original): centro (cx, cy), ancho w y alto h.
// borde = cuanto grueso es el contorno del texto (para que quepa). Si quieres mover el texto, cambia cx / cy.
const PLANTILLAS = [
  { archivo: 'koala1.png', caja: { cx: 265, cy: 438, w: 240, h: 64 }, mayus: true, estilo: 'madera', borde: 0 },
  { archivo: 'koala2.png', caja: { cx: 225, cy: 392, w: 230, h: 70 }, mayus: false, estilo: 'dulce', borde: 0.2 },
  { archivo: 'koala3.png', caja: { cx: 222, cy: 425, w: 320, h: 60 }, mayus: true, estilo: 'neon', borde: 0.07 },
  { archivo: 'koala4.png', caja: { cx: 277, cy: 405, w: 225, h: 80 }, mayus: false, estilo: 'nube', borde: 0.2 },
  { archivo: 'koala5.png', caja: { cx: 228, cy: 362, w: 215, h: 62 }, mayus: true, estilo: 'circulo', borde: 0.05 },
  { archivo: 'koala6.png', caja: { cx: 225, cy: 392, w: 230, h: 64 }, mayus: false, estilo: 'rosa', borde: 0.2 }
];

let lib = null;
const imagenes = new Map();
function cargarCanvas() {
  if (lib) return lib;
  lib = require('@napi-rs/canvas');
  try { if (fs.existsSync(FUENTE)) lib.GlobalFonts.registerFromPath(FUENTE, FAMILIA); } catch (_) { /* usa la del sistema */ }
  return lib;
}

// Estilo propio de cada koala (color, contorno, brillo)
function pintar(ctx, estilo, linea, x, y, tam) {
  const sinSombra = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };
  ctx.lineJoin = 'round';
  sinSombra();
  if (estilo === 'madera') { // grabado en la madera
    ctx.fillStyle = '#f6dfa8'; ctx.fillText(linea, x, y + tam * 0.05);
    ctx.fillStyle = '#4b2a0c'; ctx.fillText(linea, x, y);
  } else if (estilo === 'dulce') { // blanco con contorno rosa
    ctx.shadowColor = 'rgba(214,51,108,0.35)'; ctx.shadowBlur = tam * 0.12;
    ctx.lineWidth = tam * 0.2; ctx.strokeStyle = '#ee5c8f'; ctx.strokeText(linea, x, y);
    sinSombra(); ctx.fillStyle = '#ffffff'; ctx.fillText(linea, x, y);
  } else if (estilo === 'neon') { // letrero de neon
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = tam * 0.5;
    ctx.lineWidth = tam * 0.07; ctx.strokeStyle = '#00e5ff';
    ctx.strokeText(linea, x, y); ctx.strokeText(linea, x, y);
    ctx.shadowColor = '#b05cff'; ctx.shadowBlur = tam * 0.25;
    ctx.fillStyle = '#e9fdff'; ctx.fillText(linea, x, y);
  } else if (estilo === 'nube') { // morado suave
    ctx.shadowColor = 'rgba(122,86,214,0.35)'; ctx.shadowBlur = tam * 0.12;
    ctx.lineWidth = tam * 0.2; ctx.strokeStyle = '#ffffff'; ctx.strokeText(linea, x, y);
    ctx.fillStyle = '#7a56d6'; ctx.fillText(linea, x, y);
  } else if (estilo === 'circulo') { // negro con sombra roja (cuadros rojos del koala)
    ctx.fillStyle = '#e03a4e'; ctx.fillText(linea, x + tam * 0.05, y + tam * 0.05);
    ctx.fillStyle = '#16161d'; ctx.fillText(linea, x, y);
  } else { // rosa: magenta con contorno blanco
    ctx.shadowColor = 'rgba(212,24,108,0.3)'; ctx.shadowBlur = tam * 0.1;
    ctx.lineWidth = tam * 0.2; ctx.strokeStyle = '#ffffff'; ctx.strokeText(linea, x, y);
    sinSombra(); ctx.fillStyle = '#d4186c'; ctx.fillText(linea, x, y);
  }
  sinSombra();
}

// Busca el tamaño de letra mas grande que quepa en la caja; si es muy larga, la parte en 2 renglones
function ajustar(ctx, texto, caja, borde) {
  const fuente = (n) => `bold ${n}px ${FAMILIA}, sans-serif`;
  const medida = (t, n) => { ctx.font = fuente(n); return ctx.measureText(t).width + n * borde; };
  let tam = Math.floor(caja.h);
  while (tam > 12 && medida(texto, tam) > caja.w) tam -= 2;
  let lineas = [texto];
  const palabras = texto.split(' ');
  if (tam < caja.h * 0.55 && palabras.length > 1) {
    let mejor = null;
    for (let i = 1; i < palabras.length; i++) {
      const a = palabras.slice(0, i).join(' ');
      const b = palabras.slice(i).join(' ');
      const dif = Math.abs(a.length - b.length);
      if (!mejor || dif < mejor.dif) mejor = { a, b, dif };
    }
    let t2 = Math.floor(caja.h / 2.1);
    while (t2 > 12 && Math.max(medida(mejor.a, t2), medida(mejor.b, t2)) > caja.w) t2 -= 2;
    if (t2 > tam) { tam = t2; lineas = [mejor.a, mejor.b]; }
  }
  ctx.font = fuente(tam);
  return { tam, lineas };
}

// Devuelve { png (transparente, full calidad), jpg (fondo blanco, para mandar como imagen) }
async function ponerTexto(numero, texto) {
  const { createCanvas, loadImage } = cargarCanvas();
  const p = PLANTILLAS[numero - 1];
  const ruta = path.join(CARPETA, p.archivo);
  if (!imagenes.has(ruta)) imagenes.set(ruta, await loadImage(ruta));
  const img = imagenes.get(ruta);

  const lienzo = createCanvas(img.width * ESC, img.height * ESC);
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

  let t = texto.replace(EMOJI, '').replace(/\s+/g, ' ').trim() || texto;
  if (p.mayus) t = t.toUpperCase();
  const caja = { cx: p.caja.cx * ESC, cy: p.caja.cy * ESC, w: p.caja.w * ESC, h: p.caja.h * ESC };
  const { tam, lineas } = ajustar(ctx, t, caja, p.borde);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sep = tam * 1.05;
  lineas.forEach((linea, i) => pintar(ctx, p.estilo, linea, caja.cx, caja.cy + (i - (lineas.length - 1) / 2) * sep, tam));

  const fondo = createCanvas(lienzo.width, lienzo.height);
  const fctx = fondo.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, fondo.width, fondo.height);
  fctx.drawImage(lienzo, 0, 0);
  return { png: lienzo.toBuffer('image/png'), jpg: fondo.toBuffer('image/jpeg', 95) };
}

// Imagen -> mp4 de 5 segundos con zoom suave hacia adentro
function imagenAVideo(buffer) {
  return new Promise((resolve, reject) => {
    const base = path.join(os.tmpdir(), `koala-${process.pid}-${Date.now()}`);
    const entrada = `${base}.img`;
    const salida = `${base}.mp4`;
    const limpiar = () => { for (const f of [entrada, salida]) fs.unlink(f, () => {}); };
    try { fs.writeFileSync(entrada, buffer); } catch (e) { return reject(e); }
    const filtro = 'scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=white,'
      + "zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=720x720:fps=25,format=yuv420p";
    execFile('ffmpeg', ['-y', '-i', entrada, '-vf', filtro, '-c:v', 'libx264', '-movflags', 'faststart', salida], { timeout: 90000 }, (err) => {
      let mp4 = null;
      if (!err) { try { mp4 = fs.readFileSync(salida); } catch (_) { mp4 = null; } }
      limpiar();
      if (mp4 && mp4.length > 1000) resolve(mp4); else reject(new Error('ffmpeg no pudo crear el video'));
    });
  });
}

function crearComando(name, aliases, esVideo) {
  const total = PLANTILLAS.length;
  return {
    name,
    aliases,
    category: esVideo ? 'logovideo' : 'logo',
    description: (esVideo ? 'Crea un logo de koala con tu texto en video animado' : 'Crea un logo de koala con tu texto')
      + `. Uso: .${name} [1-${total}] <texto> (el numero elige el koala; sin numero sale uno al azar)`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      let contenido = String(texto || '').trim().split(/\s+/).slice(1).join(' ').replace(/["“”]/g, '').trim();
      let elegido = null;
      const m = contenido.match(/^([1-9])\s+(\S[\s\S]*)$/);
      if (m) {
        if (Number(m[1]) > total) {
          return sock.sendMessage(jid, {
            text: advertencia(`Hay ${total} koalas (del 1 al ${total}).\nEjemplo: ${prefix}${name} ${total} Panda`, { titulo: 'KOALA NO EXISTE', estilo: 'neon' })
          }, { quoted: msg });
        }
        elegido = Number(m[1]);
        contenido = m[2].trim();
      }
      if (!contenido) {
        return sock.sendMessage(jid, {
          text: advertencia(`Escribe el texto para tu logo.\nEjemplo: ${prefix}${name} Panda\nPara elegir el koala (1 al ${total}): ${prefix}${name} 2 Panda`, { titulo: 'FALTA EL TEXTO', estilo: 'neon' })
        }, { quoted: msg });
      }
      if (contenido.length > MAX_TEXTO) {
        return sock.sendMessage(jid, {
          text: advertencia(`El texto es muy largo (maximo ${MAX_TEXTO} caracteres).`, { titulo: 'TEXTO LARGO', estilo: 'neon' })
        }, { quoted: msg });
      }
      try {
        await sock.sendMessage(jid, { react: { text: '🐨', key: msg.key } });
        const disponibles = PLANTILLAS.map((p, i) => i + 1).filter((n) => fs.existsSync(path.join(CARPETA, PLANTILLAS[n - 1].archivo)));
        if (!disponibles.length) throw new Error('faltan las imagenes en assets/koala (koala1.png ... koala6.png)');
        const numero = elegido && disponibles.includes(elegido) ? elegido : disponibles[Math.floor(Math.random() * disponibles.length)];
        const { png, jpg } = await ponerTexto(numero, contenido);
        const pie = exito(`${esVideo ? 'Logo koala animado' : 'Logo koala'} · diseño ${numero}/${total}`, { titulo: esVideo ? 'LOGO VIDEO' : 'LOGO', estilo: 'neon' });
        if (esVideo) {
          const mp4 = await imagenAVideo(jpg);
          await sock.sendMessage(jid, { video: mp4, mimetype: 'video/mp4', caption: pie }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: jpg, caption: pie }, { quoted: msg });
          // Tambien como archivo PNG con fondo transparente y calidad completa
          await sock.sendMessage(jid, { document: png, mimetype: 'image/png', fileName: `logo-koala-${numero}.png` }, { quoted: msg });
        }
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      } catch (err) {
        console.error('[logokoala]', err);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(jid, {
          text: cajaError('No pude generar el logo de koala ahorita. Intenta de nuevo en un momento.', { estilo: 'neon' })
        }, { quoted: msg });
      }
    }
  };
}

module.exports = [
  crearComando('logokoala', ['koalalogo'], false),
  crearComando('logokoalavideo', ['koalavideo'], true)
];

// lib/logoletras.js
// Motor de los comandos de logo con personajes (.logogato, etc.), igual que .logokoala:
// el bot le pide a GPT-4 (Evogb) un DISEÑO de letras al azar (colores, degradado, contorno, brillo,
// sombra, profundidad) y con esa receta dibuja tu texto en el letrero / nube / corazon del personaje.
// Si GPT-4 falla o tarda, usa un diseño al azar propio: el comando nunca se queda sin responder.
//
// Cada comando da: el nombre, la carpeta de imagenes (assets/<carpeta>/) y donde va el texto en cada personaje.
// Las imagenes pueden venir de UNA hoja (assets/<carpeta>/hoja.png|jpg|webp con varios personajes en cuadricula,
// se corta sola) o de archivos sueltos (campo "archivo" en cada plantilla).
// Letras extra (opcional): archivos .ttf/.otf en assets/fonts/logos/ y la IA tambien podra elegirlos.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { advertencia, exito, error: cajaError } = require('./estilo');

const RAIZ = path.join(__dirname, '..', 'assets');
const FUENTE = path.join(RAIZ, 'fonts', 'DejaVuSans-Bold.ttf');
const CARPETA_LETRAS = path.join(RAIZ, 'fonts', 'logos');
const FAMILIA = 'LogoSans';
const MAX_TEXTO = 30;
const TIMEOUT_IA_MS = 12000; // si GPT-4 no responde en este tiempo, se usa un diseño propio
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f]/gu;

let lib = null;
let letras = null; // nombre -> { familia, negrita }
const cacheImagenes = new Map(); // ruta + fecha -> imagen

function cargarCanvas() {
  if (lib) return lib;
  lib = require('@napi-rs/canvas');
  letras = { base: { familia: FAMILIA, negrita: true } };
  try { if (fs.existsSync(FUENTE)) lib.GlobalFonts.registerFromPath(FUENTE, FAMILIA); } catch (_) { /* usa la del sistema */ }
  try {
    for (const f of fs.readdirSync(CARPETA_LETRAS)) {
      if (!/\.(ttf|otf)$/i.test(f)) continue;
      const nombre = f.replace(/\.(ttf|otf)$/i, '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24) || 'letra';
      try {
        if (lib.GlobalFonts.registerFromPath(path.join(CARPETA_LETRAS, f), 'L_' + nombre)) letras[nombre] = { familia: 'L_' + nombre, negrita: false };
      } catch (_) { /* esa letra no se pudo cargar: se ignora */ }
    }
  } catch (_) { /* no existe la carpeta: solo la letra base */ }
  return lib;
}

// ---------- Colores ----------
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function hex(valor) {
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(HEX);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h.toLowerCase();
}
function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function brillo(h) { const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
function hsl(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const azar = (a, b) => a + Math.random() * (b - a);
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// ---------- Diseño de letras: receta (la pide GPT-4, o la inventa el bot) ----------
const TEMAS = ['dulce y pastel', 'galaxia morada y azul', 'helado de fresa', 'neon cyberpunk', 'fuego y lava', 'oceano profundo', 'arcoiris', 'oro y lujo',
  'bosque y bambu', 'caramelo', 'hielo y escarcha', 'atardecer', 'chicle rosa', 'halloween', 'kawaii', 'retro 80s', 'sandia', 'menta fresca', 'lavanda', 'chocolate',
  'fantasia magica', 'verano tropical', 'cristal y diamante', 'otoño'];
const DIRECCIONES = ['vertical', 'horizontal', 'diagonal'];

// Convierte lo que diga la IA en una receta segura (si falta algo, se rellena)
function validarEstilo(crudo) {
  if (!crudo || typeof crudo !== 'object') return null;
  const colores = (Array.isArray(crudo.colores) ? crudo.colores : []).map(hex).filter(Boolean).slice(0, 3);
  if (!colores.length) return null;
  if (colores.length === 1) colores.push(colores[0]);
  const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; };
  return {
    colores,
    direccion: DIRECCIONES.includes(crudo.direccion) ? crudo.direccion : 'vertical',
    contorno: hex(crudo.contorno),
    grosor: num(crudo.grosor, 0, 0.2, 0.08),
    contorno2: hex(crudo.contorno2),
    grosor2: num(crudo.grosor2, 0, 0.2, 0),
    brillo: hex(crudo.brillo),
    profundidad: num(crudo.profundidad, 0, 0.1, 0),
    colorProfundidad: hex(crudo.color_profundidad),
    sombra: hex(crudo.sombra),
    mayus: crudo.mayus === true || crudo.mayus === 'true',
    inclinacion: num(crudo.inclinacion, -8, 8, 0),
    fuente: typeof crudo.fuente === 'string' ? crudo.fuente : 'base',
    tema: typeof crudo.tema === 'string' ? crudo.tema.slice(0, 30) : ''
  };
}

// Diseño propio al azar (respaldo cuando GPT-4 no contesta). Siempre sale distinto.
function estiloAleatorio() {
  const h = Math.floor(azar(0, 360));
  const tipo = elegir(['dulce', 'neon', 'tres-d', 'degradado', 'doble']);
  const claro = hsl(h, 90, 62);
  const claro2 = hsl((h + elegir([30, 50, 140, 180])) % 360, 90, 60);
  const oscuro = hsl(h, 70, 18);
  const base = { colores: [claro, claro2], direccion: elegir(DIRECCIONES), contorno: null, grosor: 0.08, contorno2: null, grosor2: 0, brillo: null,
    profundidad: 0, colorProfundidad: null, sombra: null, mayus: Math.random() < 0.5, inclinacion: Math.round(azar(-5, 5)), fuente: 'base', tema: '' };
  if (tipo === 'dulce') return { ...base, tema: 'dulce', colores: ['#ffffff', '#ffffff'], contorno: hsl(h, 80, 60), grosor: 0.2, sombra: hsl(h, 70, 40) };
  if (tipo === 'neon') return { ...base, tema: 'neon', colores: ['#ffffff', hsl(h, 100, 90)], contorno: hsl(h, 100, 55), grosor: 0.07, brillo: hsl(h, 100, 55) };
  if (tipo === 'tres-d') return { ...base, tema: '3D', contorno: oscuro, grosor: 0.06, profundidad: 0.07, colorProfundidad: hsl(h, 70, 30), sombra: '#000000' };
  if (tipo === 'doble') return { ...base, tema: 'doble contorno', colores: [claro, claro2], contorno: '#ffffff', grosor: 0.07, contorno2: oscuro, grosor2: 0.07 };
  return { ...base, tema: 'degradado', contorno: oscuro, grosor: 0.1 };
}

// Que no se pierdan las letras: si el relleno se parece al fondo, se obliga un contorno que contraste
function asegurarContraste(e, fondoBrillo) {
  const rellenoB = e.colores.reduce((a, c) => a + brillo(c), 0) / e.colores.length;
  const contornoB = e.contorno ? brillo(e.contorno) : null;
  if (Math.abs(rellenoB - fondoBrillo) < 0.3) {
    const nuevo = rellenoB > 0.5 ? '#1b1030' : '#ffffff';
    if (contornoB === null || Math.abs(contornoB - rellenoB) < 0.3) { e.contorno = nuevo; e.grosor = Math.max(e.grosor, 0.12); }
  }
  if (!e.contorno) e.contorno = rellenoB > 0.55 ? '#2a1238' : '#ffffff';
  if (!e.colorProfundidad) e.colorProfundidad = e.contorno;
  return e;
}

// ---------- Pedirle el diseño a GPT-4 (Evogb) ----------
function extraerJSON(texto) {
  if (texto && typeof texto === 'object') return texto;
  const t = String(texto || '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { return null; }
}

async function pedirEstiloIA(fondoBrillo, fondoHex) {
  let claves = [];
  try { claves = require('./evogb').obtenerClaves().slice(0, 2); } catch (_) { return null; }
  const nombresLetras = Object.keys(letras || { base: 1 });
  const tema = elegir(TEMAS);
  const prompt = 'Eres diseñador de letras para stickers. Responde SOLO con un objeto JSON valido, sin texto extra ni markdown. '
    + `Tema del diseño: "${tema}". Se escribira un nombre corto sobre un fondo ${fondoBrillo > 0.5 ? 'claro' : 'oscuro'} (${fondoHex}); las letras deben leerse bien contra ese fondo. `
    + 'Campos: '
    + '"colores": lista de 2 o 3 colores hex #RRGGBB para el degradado del relleno; '
    + '"direccion": "vertical", "horizontal" o "diagonal"; '
    + '"contorno": color hex del contorno; "grosor": numero de 0 a 0.2; '
    + '"contorno2": color hex de un segundo contorno exterior o null; "grosor2": numero de 0 a 0.2; '
    + '"brillo": color hex de resplandor o null; '
    + '"profundidad": numero de 0 a 0.1 (efecto 3D); "color_profundidad": color hex; '
    + '"sombra": color hex o null; "mayus": true o false; "inclinacion": numero de -8 a 8; '
    + `"fuente": una de ${JSON.stringify(nombresLetras)}; "tema": nombre corto del estilo. `
    + 'Se creativo y que se vea bonito, varia los colores y los efectos.';

  const limite = Date.now() + TIMEOUT_IA_MS;
  for (const clave of claves) {
    const restante = limite - Date.now();
    if (restante < 1500) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), restante);
    try {
      const params = new URLSearchParams({ text: prompt, session: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
      const res = await fetch(`https://api.evogb.org/ai/gpt4-session?${params}`, {
        method: 'GET', headers: { 'x-api-key': clave, Accept: 'application/json' }, signal: ctrl.signal
      });
      if (!res.ok) continue;
      const datos = await res.json();
      if (!datos || datos.status === false) continue;
      const cuerpo = datos.data !== undefined ? datos.data : (datos.result !== undefined ? datos.result : (datos.response !== undefined ? datos.response : datos.message));
      const estilo = validarEstilo(extraerJSON(cuerpo));
      if (estilo) return estilo;
    } catch (_) { /* siguiente clave */ } finally { clearTimeout(timer); }
  }
  return null;
}

// ---------- Dibujo ----------
function fuenteCss(e, tam) {
  const l = (letras && letras[e.fuente]) || (letras && letras.base) || { familia: FAMILIA, negrita: true };
  return `${l.negrita ? 'bold ' : ''}${tam}px "${l.familia}", sans-serif`;
}

// Busca el tamaño de letra mas grande que quepa en la caja; si es muy larga, la parte en 2 renglones
function ajustar(ctx, texto, caja, e) {
  const margen = (n) => n * (e.grosor + e.grosor2 + e.profundidad * 0.3);
  const medida = (t, n) => { ctx.font = fuenteCss(e, n); return ctx.measureText(t).width + margen(n); };
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
  ctx.font = fuenteCss(e, tam);
  return { tam, lineas };
}

function relleno(ctx, e, ancho, tam) {
  const m = e.direccion;
  const g = m === 'horizontal' ? ctx.createLinearGradient(-ancho / 2, 0, ancho / 2, 0)
    : m === 'diagonal' ? ctx.createLinearGradient(-ancho / 2, -tam / 2, ancho / 2, tam / 2)
      : ctx.createLinearGradient(0, -tam * 0.5, 0, tam * 0.5);
  e.colores.forEach((c, i) => g.addColorStop(e.colores.length === 1 ? 0 : i / (e.colores.length - 1), c));
  return g;
}

// Dibuja UNA linea de texto con la receta
function pintar(ctx, e, linea, x, y, tam) {
  const sinSombra = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((e.inclinacion * Math.PI) / 180);
  ctx.font = fuenteCss(e, tam);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  sinSombra();
  const ancho = ctx.measureText(linea).width;
  const w1 = tam * e.grosor;
  const w2 = tam * e.grosor2;
  const capaExterior = w2 > 0 ? w1 + w2 : w1;

  if (e.brillo) { // resplandor
    ctx.shadowColor = e.brillo; ctx.shadowBlur = tam * 0.5;
    ctx.strokeStyle = e.brillo; ctx.lineWidth = Math.max(capaExterior, tam * 0.05);
    ctx.strokeText(linea, 0, 0); ctx.strokeText(linea, 0, 0);
    sinSombra();
  }
  if (e.sombra) { // sombra suave
    ctx.shadowColor = e.sombra; ctx.shadowBlur = tam * 0.14; ctx.shadowOffsetY = tam * 0.06;
    ctx.fillStyle = e.sombra; ctx.strokeStyle = e.sombra; ctx.lineWidth = Math.max(capaExterior, 1);
    ctx.strokeText(linea, 0, 0); ctx.fillText(linea, 0, 0);
    sinSombra();
  }
  const pasos = Math.round(tam * e.profundidad); // profundidad (efecto 3D hacia abajo)
  for (let k = pasos; k >= 1; k--) {
    ctx.strokeStyle = e.colorProfundidad; ctx.fillStyle = e.colorProfundidad;
    ctx.lineWidth = Math.max(capaExterior, 1);
    ctx.strokeText(linea, 0, k); ctx.fillText(linea, 0, k);
  }
  if (w2 > 0 && e.contorno2) { ctx.strokeStyle = e.contorno2; ctx.lineWidth = w1 + w2; ctx.strokeText(linea, 0, 0); }
  if (w1 > 0) { ctx.strokeStyle = e.contorno; ctx.lineWidth = w1; ctx.strokeText(linea, 0, 0); }
  ctx.fillStyle = relleno(ctx, e, ancho, tam);
  ctx.fillText(linea, 0, 0);
  ctx.restore();
}

// Brillo promedio del fondo donde va el texto (para decirle a la IA y cuidar el contraste)
function fondoDe(ctx, caja) {
  try {
    const d = ctx.getImageData(Math.max(0, Math.round(caja.cx - caja.w / 3)), Math.max(0, Math.round(caja.cy - caja.h / 3)),
      Math.max(1, Math.round(caja.w * 0.66)), Math.max(1, Math.round(caja.h * 0.66))).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const h = '#' + [r, g, b].map((v) => Math.round(v / Math.max(n, 1)).toString(16).padStart(2, '0')).join('');
    return { hex: h, brillo: brillo(h) };
  } catch (_) { return { hex: '#cccccc', brillo: 0.8 }; }
}

// ---------- Imagenes (hoja con varios personajes, o archivos sueltos) ----------
function buscarHoja(carpeta) {
  try {
    const f = fs.readdirSync(path.join(RAIZ, carpeta)).find((n) => /^hoja\.(png|jpe?g|webp)$/i.test(n));
    return f ? path.join(RAIZ, carpeta, f) : null;
  } catch (_) { return null; }
}

function rutaDe(cfg, i) {
  const p = cfg.plantillas[i];
  if (p.archivo) { const r = path.join(RAIZ, cfg.carpeta, p.archivo); return fs.existsSync(r) ? r : null; }
  return buscarHoja(cfg.carpeta);
}

async function cargarImagen(ruta) {
  const { loadImage } = cargarCanvas();
  let marca = '';
  try { marca = String(fs.statSync(ruta).mtimeMs); } catch (_) { /* sin fecha */ }
  const clave = ruta + '|' + marca;
  if (!cacheImagenes.has(clave)) {
    for (const k of cacheImagenes.keys()) if (k.startsWith(ruta + '|')) cacheImagenes.delete(k); // la hoja cambio: se olvida la vieja
    cacheImagenes.set(clave, await loadImage(ruta));
  }
  return cacheImagenes.get(clave);
}

// Lienzo con el personaje i (0..n-1) y su texto. estiloForzado solo se usa para pruebas.
async function dibujar(cfg, i, texto, estiloForzado) {
  const { createCanvas } = cargarCanvas();
  const p = cfg.plantillas[i];
  const ruta = rutaDe(cfg, i);
  if (!ruta) throw new Error(`faltan las imagenes en assets/${cfg.carpeta} (usa .guardarhoja ${cfg.carpeta} respondiendo a la imagen)`);
  const img = await cargarImagen(ruta);

  // recorte de este personaje dentro de la hoja (si no es hoja suelta, es la imagen completa)
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (!p.archivo) {
    const cols = cfg.cols || 1, filas = cfg.filas || 1;
    sw = img.width / cols; sh = img.height / filas;
    sx = (i % cols) * sw; sy = Math.floor(i / cols) * sh;
  }
  const escala = Math.min(3, Math.max(2, Math.ceil(1000 / sw)));
  const lienzo = createCanvas(Math.round(sw * escala), Math.round(sh * escala));
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = cfg.fondo || '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);

  // la caja esta escrita para un personaje de 512 px de ancho: se ajusta al tamaño real
  const k = (lienzo.width / (cfg.ref || 512));
  const caja = { cx: p.caja.cx * k, cy: p.caja.cy * k, w: p.caja.w * k, h: p.caja.h * k };
  const fondo = fondoDe(ctx, caja);

  let estilo = estiloForzado || null;
  let origen = estiloForzado ? 'forzado' : 'ia';
  if (!estilo) { try { estilo = await pedirEstiloIA(fondo.brillo, fondo.hex); } catch (_) { estilo = null; } }
  if (!estilo) { estilo = estiloAleatorio(); origen = 'propio'; }
  asegurarContraste(estilo, fondo.brillo);

  let t = texto.replace(EMOJI, '').replace(/\s+/g, ' ').trim() || texto;
  if (estilo.mayus) t = t.toUpperCase();
  const { tam, lineas } = ajustar(ctx, t, caja, estilo);
  const sep = tam * 1.05;
  lineas.forEach((linea, n) => pintar(ctx, estilo, linea, caja.cx, caja.cy + (n - (lineas.length - 1) / 2) * sep, tam));
  return { lienzo, estilo, origen };
}

// Imagen -> mp4 de 5 segundos con zoom suave hacia adentro
function imagenAVideo(buffer, colorFondo) {
  return new Promise((resolve, reject) => {
    const base = path.join(os.tmpdir(), `logo-${process.pid}-${Date.now()}`);
    const entrada = `${base}.img`;
    const salida = `${base}.mp4`;
    const limpiar = () => { for (const f of [entrada, salida]) fs.unlink(f, () => {}); };
    try { fs.writeFileSync(entrada, buffer); } catch (e) { return reject(e); }
    const filtro = `scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=${colorFondo === '#000000' ? 'black' : 'white'},`
      + "zoompan=z='1+0.0016*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=720x720:fps=25,format=yuv420p";
    execFile('ffmpeg', ['-y', '-i', entrada, '-vf', filtro, '-c:v', 'libx264', '-movflags', 'faststart', salida], { timeout: 90000 }, (err) => {
      let mp4 = null;
      if (!err) { try { mp4 = fs.readFileSync(salida); } catch (_) { mp4 = null; } }
      limpiar();
      if (mp4 && mp4.length > 1000) resolve(mp4); else reject(new Error('ffmpeg no pudo crear el video'));
    });
  });
}

// ---------- Comandos ----------
// cfg: { name, aliases, videoName, videoAliases, carpeta, etiqueta, emoji, ejemplo, plantillas, cols, filas, fondo }
function crearComando(cfg, esVideo) {
  const total = cfg.plantillas.length;
  const name = esVideo ? cfg.videoName : cfg.name;
  return {
    name,
    aliases: esVideo ? (cfg.videoAliases || []) : (cfg.aliases || []),
    category: esVideo ? 'logovideo' : 'logo',
    description: (esVideo ? `Crea un logo de ${cfg.etiqueta} con tu texto en video animado` : `Crea un logo de ${cfg.etiqueta} con tu texto`)
      + `. Uso: .${name} [1-${total}] <texto> (el numero elige el diseño; sin numero sale uno al azar)`,
    execute: async (sock, jid, msg, { prefix, texto }) => {
      let contenido = String(texto || '').trim().split(/\s+/).slice(1).join(' ').replace(/["“”]/g, '').trim();
      let elegido = null;
      const m = contenido.match(/^([1-9])\s+(\S[\s\S]*)$/);
      if (m) {
        if (Number(m[1]) > total) {
          return sock.sendMessage(jid, {
            text: advertencia(`Hay ${total} diseños (del 1 al ${total}).\nEjemplo: ${prefix}${name} ${total} ${cfg.ejemplo}`, { titulo: 'DISEÑO NO EXISTE', estilo: 'neon' })
          }, { quoted: msg });
        }
        elegido = Number(m[1]);
        contenido = m[2].trim();
      }
      if (!contenido) {
        return sock.sendMessage(jid, {
          text: advertencia(`Escribe el texto para tu logo.\nEjemplo: ${prefix}${name} ${cfg.ejemplo}\nPara elegir el diseño (1 al ${total}): ${prefix}${name} 2 ${cfg.ejemplo}`, { titulo: 'FALTA EL TEXTO', estilo: 'neon' })
        }, { quoted: msg });
      }
      if (contenido.length > MAX_TEXTO) {
        return sock.sendMessage(jid, {
          text: advertencia(`El texto es muy largo (maximo ${MAX_TEXTO} caracteres).`, { titulo: 'TEXTO LARGO', estilo: 'neon' })
        }, { quoted: msg });
      }
      try {
        await sock.sendMessage(jid, { react: { text: cfg.emoji || '✨', key: msg.key } });
        const disponibles = cfg.plantillas.map((p, i) => i + 1).filter((n) => rutaDe(cfg, n - 1));
        if (!disponibles.length) throw new Error(`faltan las imagenes en assets/${cfg.carpeta} (usa ${prefix}guardarhoja ${cfg.carpeta} respondiendo a la imagen)`);
        const numero = elegido && disponibles.includes(elegido) ? elegido : disponibles[Math.floor(Math.random() * disponibles.length)];
        const { lienzo, estilo, origen } = await dibujar(cfg, numero - 1, contenido);
        console.log(`[${name}] diseño ${numero} · letras ${origen === 'ia' ? 'de GPT-4' : 'propias (GPT-4 no respondio)'}: ${estilo.tema || '-'}`);
        const jpg = lienzo.toBuffer('image/jpeg', 95);
        const pie = exito(`${esVideo ? `Logo ${cfg.etiqueta} animado` : `Logo ${cfg.etiqueta}`} · diseño ${numero}/${total}${estilo.tema ? ' · ' + estilo.tema : ''}`, { titulo: esVideo ? 'LOGO VIDEO' : 'LOGO', estilo: 'neon' });
        if (esVideo) {
          const mp4 = await imagenAVideo(jpg, cfg.fondo);
          await sock.sendMessage(jid, { video: mp4, mimetype: 'video/mp4', caption: pie }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { image: jpg, caption: pie }, { quoted: msg });
        }
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      } catch (err) {
        console.error(`[${name}]`, err);
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(jid, {
          text: cajaError(`No pude generar el logo ahorita. ${/faltan las imagenes/.test(String(err && err.message)) ? 'Faltan las imagenes de este comando.' : 'Intenta de nuevo en un momento.'}`, { estilo: 'neon' })
        }, { quoted: msg });
      }
    }
  };
}

function crearComandosLogo(cfg) {
  return [crearComando(cfg, false), crearComando(cfg, true)];
}

module.exports = { crearComandosLogo, dibujar, validarEstilo, estiloAleatorio, extraerJSON, asegurarContraste };

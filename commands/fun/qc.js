const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { advertencia, error: cajaError } = require('../../lib/estilo');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerDB } = require('../../lib/db');

// Quita los envoltorios de WhatsApp (mensajes temporales, ver una vez, documento con texto) hasta llegar al contenido real
function desenvolver(m) {
  let actual = m || {};
  for (let i = 0; i < 5; i++) {
    const dentro = (actual.ephemeralMessage || actual.viewOnceMessage || actual.viewOnceMessageV2 || actual.documentWithCaptionMessage || {}).message;
    if (!dentro) break;
    actual = dentro;
  }
  return actual;
}

// Texto de un mensaje: texto normal, respuesta, o el pie de una foto/video/documento
function textoDe(m) {
  const c = desenvolver(m);
  return (c.conversation
    || (c.extendedTextMessage && c.extendedTextMessage.text)
    || (c.imageMessage && c.imageMessage.caption)
    || (c.videoMessage && c.videoMessage.caption)
    || (c.documentMessage && c.documentMessage.caption)
    || '').trim();
}

function contextoDe(m) {
  const c = desenvolver(m);
  const caso = c.extendedTextMessage || c.imageMessage || c.videoMessage || c.documentMessage || c.stickerMessage || {};
  return caso.contextInfo || null;
}

const numeroDe = (id) => String(id || '').split('@')[0].split(':')[0];

// Nombre que se conoce de alguien: el de WhatsApp que el bot guarda en la base, o el que puso al registrarse
function nombreConocido(id) {
  try {
    const db = leerDB();
    const n = numeroDe(id);
    const llave = (db.registroIndice && db.registroIndice[n]) || `${n}@s.whatsapp.net`;
    const u = (db.usuarios && (db.usuarios[llave] || db.usuarios[id])) || null;
    return (u && (u.nombre || (u.registro && u.registro.nombre))) || null;
  } catch (_) { return null; }
}

async function descargarAvatar(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) return null;
    const buf = await res.buffer();
    return buf.length > 100 ? buf : null;
  } catch (_) { return null; }
}

// Respaldo: la API publica de citas (puede estar caida, por eso ya no es la primera opcion)
let apiCaidaHasta = 0;
async function citaPorApi({ nombre, texto, avatarUrl }) {
  if (Date.now() < apiCaidaHasta) throw new Error('API de citas apagada (fallo hace poco)');
  try {
    const from = { id: 1, name: nombre };
    if (avatarUrl) from.photo = { url: avatarUrl };
    const quoteObj = {
      type: 'quote', format: 'png', backgroundColor: '#000000', width: 512, height: 768, scale: 2,
      messages: [{ entities: [], avatar: true, from, text: texto, replyMessage: {} }]
    };
    const res = await fetch('https://bot.lyo.su/quote/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteObj), timeout: 10000
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !json.result || !json.result.image) throw new Error('respuesta sin imagen');
    return Buffer.from(json.result.image, 'base64');
  } catch (err) {
    apiCaidaHasta = Date.now() + 10 * 60 * 1000; // 10 min sin insistir
    throw err;
  }
}

// Primero se dibuja aqui mismo (no depende de internet); si eso falla, se prueba la API
async function crearCita(datos) {
  const errores = [];
  try {
    const { dibujarCita } = require('../../lib/quotecard');
    return await dibujarCita({ nombre: datos.nombre, texto: datos.texto, avatar: await descargarAvatar(datos.avatarUrl), semilla: datos.semilla });
  } catch (err) { errores.push(`dibujo local: ${err && err.message ? err.message : err}`); }
  try {
    return await citaPorApi(datos);
  } catch (err) { errores.push(`API: ${err && err.message ? err.message : err}`); }
  throw new Error(errores.join(' | '));
}

function aWebp(png) {
  return new Promise((resolve, reject) => {
    const base = path.join(os.tmpdir(), `qc_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const entrada = `${base}_in.png`;
    const salida = `${base}_out.webp`;
    const limpiar = () => { for (const f of [entrada, salida]) fs.unlink(f, () => {}); };
    try { fs.writeFileSync(entrada, png); } catch (err) { return reject(err); }
    const filtro = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
    execFile('ffmpeg', ['-i', entrada, '-vf', filtro, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-y', salida], { timeout: 30000 }, (err) => {
      if (err) { limpiar(); return reject(err); }
      try { const webp = fs.readFileSync(salida); limpiar(); resolve(webp); } catch (e) { limpiar(); reject(e); }
    });
  });
}

module.exports = {
  name: 'qc',
  category: 'fun',
  description: 'Crea un sticker tipo cita con un texto (o respondiendo a un mensaje)',
  _textoDe: textoDe,
  _aWebp: aWebp,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const escrito = partes.slice(1).join(' ').trim();

    const contextInfo = contextoDe(msg.message);
    const textoCitado = contextInfo && contextInfo.quotedMessage ? textoDe(contextInfo.quotedMessage) : '';
    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}qc Hola mundo`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      }, { quoted: msg });
    }

    if (textoFinal.length > 200) {
      return sock.sendMessage(jid, { text: cajaError('El texto es muy largo (maximo 200 caracteres).') }, { quoted: msg });
    }

    try {
      // Si escribes el texto, la cita es tuya. Si solo respondes a un mensaje, es de quien lo escribio.
      const remitente = msg.key.participant || msg.key.remoteJid;
      const autor = (!escrito && contextInfo && contextInfo.participant) ? contextInfo.participant : remitente;
      const esPropio = autor === remitente;
      const nombre = (esPropio && msg.pushName) || nombreConocido(autor) || numeroDe(autor);
      const avatarUrl = await sock.profilePictureUrl(autor, 'image').catch(() => null);

      const png = await crearCita({ nombre, texto: textoFinal, avatarUrl, semilla: numeroDe(autor) });

      try {
        const webp = await aWebp(png);
        await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
      } catch (errConv) {
        // Sin ffmpeg (o fallo la conversion): se manda como imagen para no quedarse sin nada
        console.error('[qc] No pude convertir a sticker, mando la imagen:', errConv && errConv.message ? errConv.message : errConv);
        await sock.sendMessage(jid, { image: png, caption: '🖼️ (No pude convertirla a sticker; revisa que ffmpeg este instalado)' }, { quoted: msg });
      }
    } catch (err) {
      console.error('[qc]', err && err.message ? err.message : err);
      let detalle = '';
      try {
        if (await esOwnerBot(sock, leerConfig(), msg)) detalle = `\n\n🔧 Detalle (solo owner): ${String(err && err.message ? err.message : err).slice(0, 400)}`;
      } catch (_) { /* sin detalle */ }
      await sock.sendMessage(jid, { text: cajaError('No se pudo crear el sticker de cita.' + detalle) }, { quoted: msg });
    }
  }
};

const { spawn } = require('child_process');
const { advertencia, error: cajaError } = require('../../lib/estilo');

// Para no repetir el mismo sticker cuando alguien busca lo mismo varias veces seguidas.
const yaEnviados = new Map(); // "usuario|busqueda" -> Set(preview)
const LIMITE_CLAVES = 500;
const MAX_BYTES = 5 * 1024 * 1024;

function esUrlSegura(valor) {
  try {
    const u = new URL(valor);
    if (u.protocol !== 'https:') return false;
    return !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname);
  } catch (_) { return false; }
}

async function descargar(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('imagen demasiado grande');
  return buf;
}

// imagen -> webp 512x512 (formato sticker) con ffmpeg por pipes
function aSticker(imagen) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-v', 'error', '-i', 'pipe:0',
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      '-vframes', '1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-f', 'webp', 'pipe:1'
    ]);
    const partes = [];
    const limite = setTimeout(() => { ff.kill('SIGKILL'); reject(new Error('ffmpeg tardo demasiado')); }, 20000);
    ff.stdout.on('data', (d) => partes.push(d));
    ff.stdin.on('error', () => {});
    ff.on('error', (err) => { clearTimeout(limite); reject(err); });
    ff.on('close', (code) => {
      clearTimeout(limite);
      const salida = Buffer.concat(partes);
      if (code === 0 && salida.length) resolve(salida);
      else reject(new Error(`ffmpeg salio con codigo ${code}`));
    });
    ff.stdin.end(imagen);
  });
}

module.exports = {
  name: 'ssearch',
  aliases: ['stickerly', 'stickers'],
  category: 'fun',
  description: 'Busca stickers en Sticker.ly y manda uno. Uso: .ssearch <tema>',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const consulta = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    if (!consulta) {
      return sock.sendMessage(jid, {
        text: advertencia(`¿Que sticker quieres buscar?\nEj: ${prefix}ssearch my melody`, { titulo: 'FALTA EL TEMA' })
      }, { quoted: msg });
    }

    try {
      const res = await fetch(`https://api.delirius.online/search/stickerly?query=${encodeURIComponent(consulta)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const lista = (await res.json())?.data;
      const packs = Array.isArray(lista) ? lista.filter((p) => p && esUrlSegura(p.preview)) : [];

      if (!packs.length) {
        return sock.sendMessage(jid, { text: cajaError(`No encontre stickers de *${consulta}*.`, { titulo: 'SIN RESULTADOS' }) }, { quoted: msg });
      }

      const remitente = msg.key.participant || msg.key.remoteJid;
      const clave = `${remitente}|${consulta.toLowerCase()}`;
      if (yaEnviados.size > LIMITE_CLAVES) yaEnviados.clear();
      if (!yaEnviados.has(clave)) yaEnviados.set(clave, new Set());
      const usados = yaEnviados.get(clave);

      const estaticos = packs.filter((p) => !p.isAnimated);
      const base = estaticos.length ? estaticos : packs;
      let candidatos = base.filter((p) => !usados.has(p.preview));
      if (!candidatos.length) { usados.clear(); candidatos = base; }
      const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
      usados.add(elegido.preview);

      const webp = await aSticker(await descargar(elegido.preview));
      await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
    } catch (err) {
      console.error('[ssearch]', err.message);
      await sock.sendMessage(jid, { text: cajaError('No pude buscar o convertir el sticker ahora mismo. Intenta de nuevo.') }, { quoted: msg });
    }
  }
};

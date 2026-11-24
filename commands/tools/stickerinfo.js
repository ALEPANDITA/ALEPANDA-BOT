// Diagnóstico: responde a un sticker con .stickerinfo y muestra qué trae el archivo por dentro (sin enviarlo a nadie).
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function imprimible(buf, max = 700) {
  const t = buf.toString('latin1').replace(/[^\x20-\x7e]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function analizar(b) {
  const r = { tamano: b.length, cabecera: b.slice(0, 4).toString('latin1') + '/' + b.slice(8, 12).toString('latin1'), chunks: [], firmas: [] };
  if (r.cabecera !== 'RIFF/WEBP') return r;
  let pos = 12;
  while (pos + 8 <= b.length && r.chunks.length < 400) {
    const id = b.slice(pos, pos + 4).toString('latin1');
    const len = b.readUInt32LE(pos + 4);
    r.chunks.push({ id, len, pos });
    pos += 8 + len + (len % 2);
  }
  r.sobrante = Math.max(0, b.length - pos);
  const buscar = [['ftyp', 'MP4/M4A'], ['OggS', 'OGG/Opus'], ['ID3', 'MP3'], ['fLaC', 'FLAC'], ['#!AMR', 'AMR'], ['RIFFWAVE', 'WAV'], ['matroska', 'WebM'], ['audio', 'palabra "audio"'], ['mp3', 'palabra "mp3"'], ['opus', 'palabra "opus"'], ['aac', 'palabra "aac"']];
  const txt = b.toString('latin1');
  for (const [firma, nombre] of buscar) { const i = txt.indexOf(firma); if (i >= 0) r.firmas.push(`${nombre} @${i}`); }
  const exif = r.chunks.find((c) => c.id === 'EXIF');
  if (exif) r.exif = imprimible(b.slice(exif.pos + 8, exif.pos + 8 + exif.len));
  return r;
}

module.exports = {
  name: 'stickerinfo',
  aliases: ['sinfo'],
  category: 'tools',
  description: 'Diagnóstico: responde a un sticker con .stickerinfo para ver qué trae por dentro',
  execute: async (sock, jid, msg) => {
    const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!citado?.stickerMessage) return sock.sendMessage(jid, { text: 'Responde a un *sticker* con *.stickerinfo*.' }, { quoted: msg });
    try {
      const buf = await downloadMediaMessage({ message: citado }, 'buffer', {});
      const r = analizar(buf);
      const cuenta = {};
      for (const c of r.chunks) cuenta[c.id] = (cuenta[c.id] || 0) + 1;
      const grandes = r.chunks.filter((c) => c.len > 2000 && !['ANMF', 'VP8 ', 'VP8L', 'ALPH'].includes(c.id)).map((c) => `${c.id}(${c.len})`);
      const t = [
        '🔬 *Dentro del sticker*', '',
        `▸ Tamaño: ${r.tamano} bytes  ·  ${r.cabecera}`,
        `▸ Partes: ${Object.entries(cuenta).map(([k, v]) => `${k}×${v}`).join(', ') || 'ninguna'}`,
        `▸ Partes grandes raras: ${grandes.join(', ') || 'ninguna'}`,
        `▸ Bytes después del final: ${r.sobrante || 0}`,
        `▸ Firmas de audio: ${r.firmas.join(', ') || 'ninguna'}`,
        `▸ EXIF: ${r.exif || 'sin EXIF'}`
      ].join('\n');
      await sock.sendMessage(jid, { text: t.slice(0, 3500) }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { text: 'No pude abrir ese sticker: ' + (e && e.message ? e.message : e) }, { quoted: msg });
    }
  }
};

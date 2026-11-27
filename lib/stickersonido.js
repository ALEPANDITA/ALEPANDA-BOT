// Stickers con sonido (los que reproducen audio al tocarlos), protocolo compatible con iPhone y Android.
// Necesita el parche de la libreria: scripts/parche-sticker-sonido.js (agrega el campo 26 del protobuf).
// - Video -> WebP animado + audio Opus mono 48 kHz (<= 128 KiB) con la MISMA duracion.
// - Se manda UN SOLO stickerMessage con el audio dentro (campo 26, ptt:false). Nada de soundStickerMessage (iOS lo rechaza).
// - El sticker de afuera NO lleva mediaKeyTimestamp; el audio de adentro SI (en segundos).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { addExif, PACKNAME_POR_DEFECTO, AUTOR_POR_DEFECTO } = require('./stickerlib');

const execFileAsync = promisify(execFile);
const SEGUNDOS_MAX = 15;                    // maximo de duracion del sticker con sonido
const PESO_MAX_WEBP = 900 * 1024;           // WhatsApp rechaza stickers animados muy pesados
const AUDIO_MAX_BYTES = 128 * 1024;         // limite del audio que acepta iPhone
const AUDIO_MIME = 'audio/ogg; codecs=opus';
const BITRATES = [64, 48, 32, 24];          // se baja de uno en uno hasta que el audio cabe en 128 KiB
const TMP = path.join(os.tmpdir(), 'alepanda-sticker-sonido');

// perfil del WebP segun la duracion (mas largo = mas chico y menos fps)
function perfilWebp(seg) {
  if (seg <= 6) return { lado: 512, fps: 12, calidades: [24, 18, 12] };
  return { lado: 420, fps: 10, calidades: [20, 15, 10] };
}

// ---- cola: una conversion a la vez (el VPS es justo de CPU) ----
let ocupado = false;
const espera = [];
function turno() { return new Promise((ok) => { const go = () => { ocupado = true; ok(); }; ocupado ? espera.push(go) : go(); }); }
function soltar() { const s = espera.shift(); if (s) s(); else ocupado = false; }

const nombre = (ext) => path.join(TMP, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`);
const borrar = (...r) => { for (const x of r) { try { fs.unlinkSync(x); } catch (_) { /* nada */ } } };
const ff = (args) => execFileAsync('ffmpeg', ['-y', '-nostdin', '-loglevel', 'error', '-threads', '2', ...args], { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

async function tieneAudio(archivo) {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', archivo], { timeout: 20000 });
    return /audio/.test(stdout);
  } catch (_) { return false; }
}
async function duracionDe(archivo, fallback = SEGUNDOS_MAX) {
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { timeout: 20000 });
    const d = parseFloat(stdout);
    return Number.isFinite(d) && d > 0 ? d : fallback;
  } catch (_) { return fallback; }
}

// ---- lectura binaria del WebP y del Ogg/Opus ----
// { esWebp, animado, ancho, alto, cuadros, duracionMs }  (la duracion es la suma real de los cuadros ANMF)
function analizarWebp(buf) {
  const r = { esWebp: false, animado: false, ancho: 0, alto: 0, cuadros: 0, duracionMs: 0 };
  if (!buf || buf.length < 20 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return r;
  r.esWebp = true;
  for (let i = 12; i + 8 <= buf.length;) {
    const tipo = buf.toString('ascii', i, i + 4);
    const tam = buf.readUInt32LE(i + 4);
    const dato = i + 8;
    if (tipo === 'VP8X' && dato + 10 <= buf.length) {
      r.animado = (buf[dato] & 0x02) !== 0;
      r.ancho = buf.readUIntLE(dato + 4, 3) + 1;
      r.alto = buf.readUIntLE(dato + 7, 3) + 1;
    } else if (tipo === 'ANMF' && dato + 15 <= buf.length) {
      r.cuadros += 1;
      r.duracionMs += buf.readUIntLE(dato + 12, 3);
    }
    i = dato + tam + (tam % 2);
  }
  return r;
}

// { duracionMs, canales, hz } o null si no es un Ogg/Opus mono de 48 kHz valido
function leerOggOpus(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 47) return null;
  let preSkip = 0; let granule = BigInt(-1); let serie = 0; let fin = false; let canales = 0; let hz = 0;
  for (let i = 0; i < buf.length;) {
    if (i + 27 > buf.length || buf.toString('ascii', i, i + 4) !== 'OggS' || buf[i + 4] !== 0) return null;
    const n = buf[i + 26];
    const ini = i + 27 + n;
    if (ini > buf.length) return null;
    let len = 0;
    for (let k = 0; k < n; k++) len += buf[i + 27 + k];
    if (ini + len > buf.length) return null;
    const banderas = buf[i + 5];
    const serieP = buf.readUInt32LE(i + 14);
    const granuleP = buf.readBigInt64LE(i + 6);
    if (i === 0) {
      if ((banderas & 2) === 0 || len < 19 || buf.toString('ascii', ini, ini + 8) !== 'OpusHead') return null;
      canales = buf[ini + 9]; preSkip = buf.readUInt16LE(ini + 10); hz = buf.readUInt32LE(ini + 12);
      if (canales !== 1 || hz !== 48000) return null;
      serie = serieP;
    } else {
      if (serieP !== serie) return null;
      if (granuleP >= 0n) granule = granuleP;
      if ((banderas & 4) !== 0) fin = true;
    }
    i = ini + len;
  }
  if (!fin || granule < BigInt(preSkip)) return null;
  return { duracionMs: Number(((granule - BigInt(preSkip)) * 1000n) / 48000n), canales, hz };
}

// Devuelve { webp, ogg, segundos }. Lanza Error('SIN_AUDIO') si el video no trae sonido.
// El sticker sale con el EXIF normal (nombre de paquete y autor), SIN banderas VIP: esas bloquean el sonido.
async function crearSonoro(videoBuffer, { packname = PACKNAME_POR_DEFECTO, author = AUTOR_POR_DEFECTO } = {}) {
  fs.mkdirSync(TMP, { recursive: true });
  await turno();
  const entrada = nombre('mp4');
  const salidaWebp = nombre('webp');
  const salidaOgg = nombre('ogg');
  try {
    fs.writeFileSync(entrada, videoBuffer);
    if (!(await tieneAudio(entrada))) throw new Error('SIN_AUDIO');
    const dur = Math.max(0.5, Math.min(SEGUNDOS_MAX, await duracionDe(entrada)));
    const p = perfilWebp(dur);
    const filtroVideo = `setpts=PTS-STARTPTS,fps=${p.fps},scale=${p.lado}:${p.lado}:force_original_aspect_ratio=decrease,pad=${p.lado}:${p.lado}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba`;

    const hacerWebp = (async () => {
      for (const q of p.calidades) {
        await ff(['-i', entrada, '-t', dur.toFixed(3), '-vf', filtroVideo,
          '-vcodec', 'libwebp', '-preset', 'default', '-q:v', String(q), '-compression_level', '6', '-loop', '0', '-an', salidaWebp]);
        const b = fs.readFileSync(salidaWebp);
        if (b.length <= PESO_MAX_WEBP) return b;
      }
      throw new Error('El sticker quedo muy pesado, prueba con un video mas corto.');
    })();

    // audio: Opus mono 48 kHz, recortado/rellenado a la duracion del video, bajando bitrate hasta que cabe en 128 KiB
    const hacerAudio = (async () => {
      const filtro = 'asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,aresample=48000:async=1:first_pts=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad';
      for (const kbps of BITRATES) {
        await ff(['-i', entrada, '-t', dur.toFixed(3), '-map', '0:a:0', '-vn', '-sn', '-dn', '-af', filtro,
          '-c:a', 'libopus', '-application', 'voip', '-b:a', `${kbps}k`, '-vbr', 'on', '-compression_level', '10',
          '-ac', '1', '-ar', '48000', '-map_metadata', '-1', '-f', 'ogg', salidaOgg]);
        const b = fs.readFileSync(salidaOgg);
        if (b.length <= AUDIO_MAX_BYTES && leerOggOpus(b)) return b;
      }
      throw new Error('El audio quedo muy pesado, prueba con un video mas corto.');
    })();
    const [webpCrudo, ogg] = await Promise.all([hacerWebp, hacerAudio]);

    const info = leerOggOpus(ogg);
    const an = analizarWebp(webpCrudo);
    const msAudio = info ? info.duracionMs : dur * 1000;
    const segundos = Math.max(1, Math.ceil((an.duracionMs ? Math.max(an.duracionMs, msAudio) : msAudio) / 1000));
    const webp = await addExif(webpCrudo, packname, author);
    return { webp, ogg, segundos };
  } finally {
    borrar(entrada, salidaWebp, salidaOgg);
    soltar();
  }
}

// ---- envio ----
function baileys() { return require('@whiskeysockets/baileys'); }
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// true si la libreria ya tiene el parche: el campo 26 (audio dentro del sticker) y ptt:false explicito sobreviven
function parcheActivo() {
  try {
    const { proto } = baileys();
    const M = proto.Message;
    const a = M.decode(M.encode(M.fromObject({ stickerMessage: { audioMessage: { seconds: 1, ptt: false } } })).finish()).stickerMessage?.audioMessage;
    return !!a && tiene(a, 'ptt') && a.ptt === false;
  } catch (_) { return false; }
}

// Campos "limpios" de lo que devuelve la subida (sin waveform, sidecar, ni timestamps raros)
function limpiar(obj, campos) {
  const r = {};
  for (const c of campos) if (obj && obj[c] != null) r[c] = obj[c];
  return r;
}
const CAMPOS_SUBIDA = ['url', 'directPath', 'mediaKey', 'fileEncSha256', 'fileSha256', 'fileLength'];

// Revisa el mensaje ya armado: lo que iPhone exige
function revisarMensaje(contenido) {
  const { proto } = baileys();
  const M = proto.Message;
  const dec = M.decode(M.encode(M.fromObject(contenido)).finish());
  const st = dec.stickerMessage; const aud = st && st.audioMessage;
  if (!st || !aud) throw new Error('SIN_PARCHE');
  if (!tiene(aud, 'ptt') || aud.ptt !== false) throw new Error('El audio perdio ptt=false.');
  if (tiene(st, 'mediaKeyTimestamp') && st.mediaKeyTimestamp) throw new Error('El sticker de afuera no debe llevar mediaKeyTimestamp.');
  if (!aud.mediaKeyTimestamp) throw new Error('El audio debe llevar mediaKeyTimestamp.');
  if (aud.mimetype !== AUDIO_MIME) throw new Error('Mimetype de audio incorrecto.');
}

async function enviarSonoro(sock, jid, { webp, ogg, segundos }, { vip = false, quoted = null } = {}) {
  const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = baileys();
  if (!parcheActivo()) throw new Error('SIN_PARCHE');
  const an = analizarWebp(webp);

  const subir = () => Promise.all([
    prepareWAMessageMedia({ sticker: webp, isAnimated: true }, { upload: sock.waUploadToServer }),
    prepareWAMessageMedia({ audio: ogg, mimetype: AUDIO_MIME, ptt: false, seconds: segundos }, { upload: sock.waUploadToServer })
  ]);
  let stickerMedia; let audioMedia;
  try { [stickerMedia, audioMedia] = await subir(); } catch (e) {
    if (/media upload failed/i.test(String(e && e.message)) && typeof sock.refreshMediaConn === 'function') {
      await sock.refreshMediaConn(true).catch(() => {});
      [stickerMedia, audioMedia] = await subir();
    } else throw e;
  }
  if (!stickerMedia?.stickerMessage || !audioMedia?.audioMessage) throw new Error('No se pudo subir el sticker o el audio a WhatsApp.');

  const sticker = {
    ...limpiar(stickerMedia.stickerMessage, CAMPOS_SUBIDA),
    mimetype: 'image/webp',
    isAnimated: true,
    width: an.ancho || 512,
    height: an.alto || 512,
    stickerSentTs: Date.now()
  };
  if (vip) sticker.isAvatar = true; // la estrella VIP va aqui, no en el EXIF

  const audio = {
    ...limpiar(audioMedia.audioMessage, CAMPOS_SUBIDA),
    mimetype: AUDIO_MIME,
    seconds: segundos,
    ptt: false,
    mediaKeyTimestamp: Math.floor(Date.now() / 1000)
  };
  if (sticker.mediaKey && audio.mediaKey && Buffer.from(sticker.mediaKey).equals(Buffer.from(audio.mediaKey))) throw new Error('Las claves del audio y del sticker deben ser distintas.');
  sticker.audioMessage = audio;

  const previo = proto.Message.fromObject({ stickerMessage: sticker });
  revisarMensaje(previo);
  const hayCita = !!(quoted && quoted.key && quoted.message);
  const wa = generateWAMessageFromContent(jid, previo, { userJid: sock.user?.id || '', ...(hayCita ? { quoted } : {}) });
  if (wa.message?.stickerMessage && tiene(wa.message.stickerMessage, 'mediaKeyTimestamp')) delete wa.message.stickerMessage.mediaKeyTimestamp;
  revisarMensaje(wa.message);

  const messageId = wa.key?.id || ('3EB0' + crypto.randomBytes(9).toString('hex').toUpperCase());
  await sock.relayMessage(jid, wa.message, { messageId });
  return messageId;
}

module.exports = { crearSonoro, enviarSonoro, parcheActivo, analizarWebp, leerOggOpus, SEGUNDOS_MAX };

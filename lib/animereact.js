const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const RESPALDO = {
  kiss: [
    'https://media.tenor.com/sbMBW4a-VN4AAAAM/anime-kiss.gif',
    'https://media.tenor.com/lJPu85pBQLEAAAAM/kiss.gif',
    'https://media.tenor.com/HdnsMy2ELv8AAAAM/kiss.gif',
    'https://media.tenor.com/YHxJ9NvLYKsAAAAM/anime-kiss.gif'
  ],
  hug: [
    'https://telegra.ph/file/6a3aa01fabb95e3558eec.mp4',
    'https://telegra.ph/file/0e5b24907be34da0cbe84.mp4',
    'https://telegra.ph/file/3e443a3363a90906220d8.mp4',
    'https://telegra.ph/file/436624e53c5f041bfd597.mp4'
  ],
  pat: [
    'https://media.tenor.com/Zm71HaIh7wwAAAAM/pat-pat.gif',
    'https://media.tenor.com/Z-28SFKJaIsAAAAM/anime-pat.gif',
    'https://media.tenor.com/mecnd_qE8p8AAAAM/anime-pat.gif',
    'https://media.tenor.com/mYzBXEhbbvgAAAAM/anime-pat.gif'
  ],
  slap: [
    'https://media.tenor.com/Ws6Dm1ZW_vMAAAAM/girl-slap.gif',
    'https://media.tenor.com/ZozZrvtEdAkAAAAM/slap.gif',
    'https://media.tenor.com/yJmrNruFNtEAAAAM/slap.gif',
    'https://media.tenor.com/XiYuU9h44-AAAAAM/anime-slap-mad.gif'
  ],
  shoot: [
    'https://media.tenor.com/kfaP8onvWvsAAAAM/anime-gun.gif',
    'https://media.tenor.com/QzHhZuVdF6EAAAAM/anime-shoot.gif',
    'https://media.tenor.com/1i2xztHquCEAAAAM/anime-gun-shoot.gif',
    'https://media.tenor.com/6ceKGx-oaP4AAAAM/anime-shooting.gif'
  ],
  punch: [
    'https://media.tenor.com/2Bw55_pkefsAAAAM/anime-punch.gif',
    'https://media.tenor.com/vNfL6dW1QGYAAAAM/anime-punch.gif',
    'https://media.tenor.com/1_XVKtF9E3IAAAAM/punch-anime.gif',
    'https://media.tenor.com/K3nO6NDmqTgAAAAM/anime-fight-punch.gif'
  ]
};

const MAPA_WAIFU = {
  kiss: 'kiss',
  hug: 'hug',
  pat: 'pat',
  slap: 'slap',
  shoot: 'kill',
  kill: 'kill',
  kick: 'kick',
  bite: 'bite',
  cuddle: 'cuddle',
  lick: 'lick',
  poke: 'poke',
  wink: 'wink',
  dance: 'dance',
  cringe: 'cringe',
  punch: null
};

function mezclar(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

async function fetchJsonSeguro(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json,text/plain,*/*'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const limpio = String(text || '').trim();

  if (!limpio) throw new Error('Respuesta vacia');
  if (limpio.startsWith('<!DOCTYPE') || limpio.startsWith('<html')) {
    throw new Error('La API devolvio HTML en vez de JSON');
  }

  try {
    return JSON.parse(limpio);
  } catch {
    throw new Error('La API no devolvio JSON valido');
  }
}

async function obtenerReaccion(tipo) {
  try {
    const data = await fetchJsonSeguro(`https://nekos.best/api/v2/${tipo}`);
    const resultado = data?.results?.[0];
    if (resultado?.url) return resultado;
    throw new Error('Respuesta vacia de nekos.best');
  } catch (err) {
    console.warn(`nekos.best fallo para "${tipo}" (${err.message}), probando waifu.pics...`);
  }

  try {
    const tipoWaifu = MAPA_WAIFU[tipo];
    if (!tipoWaifu) throw new Error(`Sin mapeo waifu.pics para "${tipo}"`);

    const data = await fetchJsonSeguro(`https://api.waifu.pics/sfw/${tipoWaifu}`);
    if (data?.url) return { url: data.url };
    throw new Error('Respuesta vacia de waifu.pics');
  } catch (err) {
    console.warn(`waifu.pics tambien fallo para "${tipo}": ${err.message}`);
  }

  const lista = RESPALDO[tipo];
  if (lista?.length) {
    return { respaldo: true, urls: mezclar(lista) };
  }

  throw new Error('No se pudo obtener la imagen (nekos.best, waifu.pics y respaldo fallaron).');
}

async function descargarArchivo(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el archivo`);
  return Buffer.from(await res.arrayBuffer());
}

function convertirGifAMp4(bufferGif) {
  return new Promise((resolve, reject) => {
    try {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const gifPath = path.join(os.tmpdir(), `reaccion_${id}.gif`);
      const mp4Path = path.join(os.tmpdir(), `reaccion_${id}.mp4`);

      fs.writeFileSync(gifPath, bufferGif);

      const comando = `ffmpeg -i "${gifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -y "${mp4Path}"`;

      exec(comando, (error) => {
        fs.unlink(gifPath, () => {});
        if (error) return reject(error);

        try {
          const mp4Buffer = fs.readFileSync(mp4Path);
          fs.unlink(mp4Path, () => {});
          resolve(mp4Buffer);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function esMp4(url) {
  return /\.mp4(\?|$)/i.test(url);
}

async function descargarYConvertirAMp4(mediaUrl) {
  const buffer = await descargarArchivo(mediaUrl);
  if (esMp4(mediaUrl)) return buffer;
  return await convertirGifAMp4(buffer);
}

async function obtenerBufferReaccion(reaccion) {
  if (reaccion?.url) {
    return await descargarYConvertirAMp4(reaccion.url);
  }

  if (reaccion?.respaldo && Array.isArray(reaccion.urls)) {
    let ultimoError = null;

    for (const url of reaccion.urls) {
      try {
        return await descargarYConvertirAMp4(url);
      } catch (err) {
        ultimoError = err;
        console.warn(`Respaldo caido: ${url} -> ${err.message}`);
      }
    }

    throw ultimoError || new Error('Todos los respaldos fallaron');
  }

  throw new Error('No se encontro una reaccion valida');
}

async function enviarReaccion(sock, jid, msg, { tipo, emoji, conObjetivo, sinObjetivo }) {
  const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
  const remitente = msg.key.participant || msg.key.remoteJid;
  const objetivo = mencionado || citado;

  try {
    const reaccion = await obtenerReaccion(tipo);
    const buffer = await obtenerBufferReaccion(reaccion);

    const numRemitente = remitente.split('@')[0];
    const numObjetivo = objetivo ? objetivo.split('@')[0] : null;

    const caption = objetivo
      ? `${emoji} ${conObjetivo(numRemitente, numObjetivo)}`
      : `${emoji} ${sinObjetivo(numRemitente)}`;

    await sock.sendMessage(
      jid,
      {
        video: buffer,
        gifPlayback: true,
        caption,
        mentions: [remitente, objetivo].filter(Boolean)
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error(err);
    await sock.sendMessage(
      jid,
      { text: 'No se pudo obtener la imagen, intenta de nuevo.' },
      { quoted: msg }
    );
  }
}

module.exports = { obtenerReaccion, enviarReaccion };

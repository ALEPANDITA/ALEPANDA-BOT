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

async function obtenerReaccion(tipo) {
  try {
    const res = await fetch(`https://nekos.best/api/v2/${tipo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const resultado = data?.results?.[0];
    if (resultado?.url) return resultado;
    throw new Error('Respuesta vacia de nekos.best');
  } catch (err) {
    console.warn(`nekos.best fallo para "${tipo}", usando respaldo:`, err.message);

    const lista = RESPALDO[tipo];
    if (lista?.length) {
      return { url: lista[Math.floor(Math.random() * lista.length)] };
    }

    throw new Error('No se pudo obtener la imagen (API y respaldo fallaron).');
  }
}

function descargarYConvertirAMp4(gifUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(gifUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el gif`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const gifPath = path.join(os.tmpdir(), `reaccion_${id}.gif`);
      const mp4Path = path.join(os.tmpdir(), `reaccion_${id}.mp4`);

      fs.writeFileSync(gifPath, buffer);

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

async function enviarReaccion(sock, jid, msg, { tipo, emoji, conObjetivo, sinObjetivo }) {
  const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
  const remitente = msg.key.participant || msg.key.remoteJid;
  const objetivo = mencionado || citado;

  try {
    const reaccion = await obtenerReaccion(tipo);
    const buffer = await descargarYConvertirAMp4(reaccion.url);
    const numRemitente = remitente.split('@')[0];
    const caption = objetivo
      ? `${emoji} ${conObjetivo(numRemitente, objetivo.split('@')[0])}`
      : `${emoji} ${sinObjetivo(numRemitente)}`;

    await sock.sendMessage(jid, {
      video: buffer,
      gifPlayback: true,
      caption,
      mentions: [remitente, objetivo].filter(Boolean)
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    await sock.sendMessage(jid, { text: 'No se pudo obtener la imagen, intenta de nuevo.' }, { quoted: msg });
  }
}

module.exports = { obtenerReaccion, enviarReaccion };

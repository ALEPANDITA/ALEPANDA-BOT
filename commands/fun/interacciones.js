const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function pedirGif(reaction) {
  const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${reaction}`);

  if (!res.ok) {
    throw new Error(`La API respondio con estado ${res.status}`);
  }

  const data = await res.json();
  return data?.url;
}

function convertirGifAMp4(gifUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(gifUrl);
      const buffer = Buffer.from(await res.arrayBuffer());

      const gifPath = path.join(os.tmpdir(), `anime_${Date.now()}.gif`);
      const mp4Path = path.join(os.tmpdir(), `anime_${Date.now()}.mp4`);

      fs.writeFileSync(gifPath, buffer);

      const comando = `ffmpeg -i "${gifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -y "${mp4Path}"`;

      exec(comando, (error) => {
        fs.unlinkSync(gifPath);
        if (error) return reject(error);
        resolve(mp4Path);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function crearComando(nombre, reaction, verbo) {
  return {
    name: nombre,
    category: 'anime',
    description: `Envia un gif de anime: ${verbo} (mencion opcional)`,
    execute: async (sock, jid, msg) => {
      const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const remitente = msg.key.participant || msg.key.remoteJid;
      const numeroRemitente = remitente.split('@')[0];

      try {
        const gifUrl = await pedirGif(reaction);
        if (!gifUrl) {
          return sock.sendMessage(jid, { text: 'No se pudo obtener el gif, intenta de nuevo.' });
        }

        const mp4Path = await convertirGifAMp4(gifUrl);
        const buffer = fs.readFileSync(mp4Path);
        fs.unlinkSync(mp4Path);

        let caption;
        if (mencionado) {
          caption = `@${numeroRemitente} ${verbo} a @${mencionado.split('@')[0]}`;
        } else {
          caption = `@${numeroRemitente} ${verbo}...`;
        }

        await sock.sendMessage(jid, {
          video: buffer,
          gifPlayback: true,
          caption,
          mentions: mencionado ? [remitente, mencionado] : [remitente]
        });
      } catch (err) {
        console.error(`Error en comando ${nombre}:`, err.message);
        await sock.sendMessage(jid, { text: 'Ocurrio un error al obtener el gif. Intenta de nuevo en unos segundos.' });
      }
    }
  };
}

module.exports = [
  crearComando('beso', 'kiss', 'le dio un beso'),
  crearComando('abrazo', 'hug', 'le dio un abrazo'),
  crearComando('palmadita', 'pat', 'le dio una palmadita'),
  crearComando('mimos', 'cuddle', 'le dio mimos'),
  crearComando('cosquillas', 'tickle', 'le hizo cosquillas'),
  crearComando('cachetada', 'slap', 'le dio una cachetada'),
  crearComando('picar', 'poke', 'le pico'),
  crearComando('morder', 'bite', 'le mordio'),
  crearComando('llorar', 'cry', 'esta llorando'),
  crearComando('bailar', 'dance', 'esta bailando'),
  crearComando('choca', 'highfive', 'choco los cinco con'),
  crearComando('patada', 'kick', 'le dio una patada'),
  crearComando('punetazo', 'punch', 'le dio un punetazo'),
  crearComando('sonreir', 'smile', 'sonrio'),
  crearComando('mirar', 'stare', 'esta mirando fijamente a'),
  crearComando('pensar', 'think', 'esta pensando'),
  crearComando('saludar', 'wave', 'saludo a'),
  crearComando('guiño', 'wink', 'le guiño el ojo a'),
  crearComando('sonrojo', 'blush', 'se sonrojo con'),
  crearComando('feliz', 'happy', 'esta feliz'),
  crearComando('reir', 'laugh', 'se esta riendo de'),
  crearComando('nervioso', 'nervous', 'esta nervioso con'),
  crearComando('sorpresa', 'wag', 'esta sorprendido con'),
  crearComando('correr', 'run', 'esta corriendo de'),
  crearComando('dormir', 'sleep', 'se durmio en'),
  crearComando('lamer', 'lick', 'le lamio'),
  crearComando('bonk', 'bonk', 'le dio un bonk'),
  crearComando('amor', 'love', 'ama a'),
  crearComando('facepalm', 'facepalm', 'hizo facepalm por'),
  crearComando('tomarmano', 'handhold', 'le tomo la mano a')
];

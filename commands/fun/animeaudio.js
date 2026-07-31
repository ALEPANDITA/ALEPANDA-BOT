const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

module.exports = {
  name: 'animeaudio',
  aliases: ['animesound', 'audioanime'],
  category: 'fun',
  description: 'Busca y envia un audio/sonido de anime. Uso: .animeaudio <personaje o frase>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const query = partes.slice(1).join(' ').trim();

    if (!query) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}animeaudio <personaje, anime o frase>\nEjemplo: ${prefix}animeaudio zenitsu` });
    }

    await sock.sendMessage(jid, { text: `🔎 Buscando audio de *${query}*...` });

    let data;
    try {
      const res = await fetch(`https://myinstants-api.vercel.app/search?q=${encodeURIComponent('anime ' + query)}`);
      data = await res.json();
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: 'Ocurrio un error al buscar el audio.' });
    }

    const resultados = data?.data || [];
    if (!resultados.length) {
      return sock.sendMessage(jid, { text: `No encontre ningun audio de anime para "${query}".` });
    }

    const elegido = resultados[0];
    const mp3Path = path.join(os.tmpdir(), `animeaudio_${Date.now()}.mp3`);
    const oggPath = path.join(os.tmpdir(), `animeaudio_${Date.now()}.ogg`);

    try {
      const resAudio = await fetch(elegido.mp3);
      const buffer = Buffer.from(await resAudio.arrayBuffer());
      fs.writeFileSync(mp3Path, buffer);

      // WhatsApp requiere OGG/Opus para notas de voz (ptt), no MP3 directo.
      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${mp3Path}" -c:a libopus -b:a 32k -y "${oggPath}"`, (error) => {
          error ? reject(error) : resolve();
        });
      });

      const oggBuffer = fs.readFileSync(oggPath);
      await sock.sendMessage(jid, { audio: oggBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      await sock.sendMessage(jid, { text: `🎧 *${elegido.title}*` });

      fs.unlinkSync(mp3Path);
      fs.unlinkSync(oggPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Encontre el audio pero no pude convertirlo/enviarlo.' });
    }
  }
};

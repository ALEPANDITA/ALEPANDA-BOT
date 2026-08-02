const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getApiKey } = require('../../lib/apikeys');

const DURACION_CLIP_SEG = 20;
const TOKEN_PRUEBA = 'test';

module.exports = {
  name: 'shazam',
  aliases: ['audio', 'cancion', 'identificar', 'quecancion'],
  category: 'tools',
  description: 'Responde a un video o audio con .shazam para identificar que cancion es',
  execute: async (sock, jid, msg) => {
    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    const mensajeConMedia = citado?.videoMessage
      ? { message: citado }
      : citado?.audioMessage
        ? { message: citado }
        : msg.message.videoMessage
          ? msg
          : msg.message.audioMessage
            ? msg
            : null;

    if (!mensajeConMedia) {
      return sock.sendMessage(jid, {
        text: 'Responde a un video o un audio con .shazam (o .audio, .cancion) para que identifique que cancion es.'
      }, { quoted: msg });
    }

    const apiKey = getApiKey('audd') || TOKEN_PRUEBA;
    const usandoTokenPrueba = apiKey === TOKEN_PRUEBA;

    await sock.sendMessage(jid, { text: '🎧 Escuchando y buscando la cancion...' }, { quoted: msg });

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `shazam_in_${Date.now()}`);
    const outputPath = path.join(tmpDir, `shazam_out_${Date.now()}.mp3`);

    try {
      const buffer = await downloadMediaMessage(mensajeConMedia, 'buffer', {});
      fs.writeFileSync(inputPath, buffer);

      const comandoFfmpeg = `ffmpeg -i "${inputPath}" -t ${DURACION_CLIP_SEG} -vn -acodec libmp3lame -ar 44100 -ac 2 -b:a 128k -y "${outputPath}"`;
      await new Promise((resolve, reject) => {
        exec(comandoFfmpeg, { maxBuffer: 1024 * 1024 * 20 }, (error) => (error ? reject(error) : resolve()));
      });

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error('No se pudo sacar audio de ese archivo (puede que no tenga sonido).');
      }

      const audioBuffer = fs.readFileSync(outputPath);

      const formData = new FormData();
      formData.append('api_token', apiKey);
      formData.append('return', 'spotify,apple_music');
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'clip.mp3');

      const respuesta = await fetch('https://api.audd.io/', { method: 'POST', body: formData });
      const data = await respuesta.json();

      if (data.status !== 'success') {
        const detalle = data?.error?.error_message || 'Error desconocido de AudD.';
        throw new Error(detalle);
      }

      if (!data.result) {
        let texto = '😕 No logre identificar esa cancion. Prueba con un fragmento donde se escuche mas claro (sin mucho ruido de fondo o voces encima).';
        if (usandoTokenPrueba) {
          texto += `\n\n_(Ojo: estas usando el token de prueba compartido, solo 10 busquedas al dia entre todos. Consigue el tuyo gratis en dashboard.audd.io y guardalo con .setapikey audd <tu_token> para tener mas.)_`;
        }
        return sock.sendMessage(jid, { text: texto }, { quoted: msg });
      }

      const r = data.result;
      const lineas = [
        `🎵 *${r.title || 'Titulo desconocido'}*`,
        `🎤 ${r.artist || 'Artista desconocido'}`
      ];
      if (r.album) lineas.push(`💿 Album: ${r.album}`);
      if (r.release_date) lineas.push(`📅 ${r.release_date}`);
      if (r.spotify?.external_urls?.spotify) lineas.push(`🟢 Spotify: ${r.spotify.external_urls.spotify}`);
      if (r.apple_music?.url) lineas.push(`🍎 Apple Music: ${r.apple_music.url}`);
      if (r.song_link) lineas.push(`🔗 ${r.song_link}`);

      if (usandoTokenPrueba) {
        lineas.push('', '_(usando el token de prueba compartido, 10 al dia entre todos — consigue el tuyo gratis en dashboard.audd.io)_');
      }

      const portada = r.spotify?.album?.images?.[0]?.url || r.apple_music?.artwork?.url?.replace('{w}x{h}', '500x500') || null;

      if (portada) {
        await sock.sendMessage(jid, { image: { url: portada }, caption: lineas.join('\n') }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
      }
    } catch (err) {
      console.error('[shazam] error:', err);
      const mensajeError = /no such file|ffmpeg: not found|command not found/i.test(err.message || '')
        ? 'El servidor no tiene ffmpeg instalado, no puedo procesar el audio.'
        : `No se pudo identificar la cancion: ${err.message}`;
      await sock.sendMessage(jid, { text: mensajeError }, { quoted: msg });
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }
};

const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function buscarVoz(nombrePersonaje) {
  const res = await fetch('https://api.fakeyou.com/tts/list');
  const data = await res.json();
  const voces = data?.models || [];

  const termino = nombrePersonaje.toLowerCase();
  const coincidencias = voces.filter(v =>
    (v.title || '').toLowerCase().includes(termino)
  );

  if (!coincidencias.length) return null;

  // Prioriza coincidencias en ingles o con mas "ratings" si el campo existe
  coincidencias.sort((a, b) => (b.user_ratings?.positive || 0) - (a.user_ratings?.positive || 0));
  return coincidencias[0];
}

async function generarAudio(modelToken, texto) {
  const resInicio = await fetch('https://api.fakeyou.com/tts/inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tts_model_token: modelToken,
      uuid_idempotency_token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      inference_text: texto
    })
  });

  const dataInicio = await resInicio.json();
  const jobToken = dataInicio?.inference_job_token;
  if (!jobToken) throw new Error('No se pudo iniciar el trabajo de voz.');

  // Consulta el estado del trabajo cada 3 segundos, hasta 10 intentos (~30s)
  for (let intento = 0; intento < 10; intento++) {
    await esperar(3000);
    const resEstado = await fetch(`https://api.fakeyou.com/tts/job/${jobToken}`);
    const dataEstado = await resEstado.json();
    const estado = dataEstado?.state?.status;

    if (estado === 'complete_success') {
      const rutaAudio = dataEstado.state.maybe_public_bucket_wav_audio_path;
      return `https://storage.googleapis.com/vocodes-public${rutaAudio}`;
    }

    if (estado === 'complete_failure' || estado === 'attempt_failed' || estado === 'dead') {
      throw new Error('La generacion de voz fallo del lado de FakeYou.');
    }
  }

  throw new Error('Se agoto el tiempo esperando el audio generado.');
}

module.exports = {
  name: 'animevoz',
  aliases: ['animetts', 'vozanime'],
  category: 'fun',
  description: 'Texto a voz con personajes de anime. Uso: .animevoz <personaje> | <mensaje>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const contenido = texto.trim().split(/\s+/).slice(1).join(' ');
    const [personaje, mensaje] = contenido.split('|').map(t => (t || '').trim());

    if (!personaje || !mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}animevoz <personaje> | <mensaje>\nEjemplo: ${prefix}animevoz zenitsu | hola a todos`
      });
    }

    await sock.sendMessage(jid, { text: `🔎 Buscando la voz de *${personaje}*...` });

    let voz;
    try {
      voz = await buscarVoz(personaje);
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: 'Ocurrio un error al buscar la voz.' });
    }

    if (!voz) {
      return sock.sendMessage(jid, { text: `No encontre ninguna voz de "${personaje}". Prueba con el nombre en ingles o de otra forma.` });
    }

    await sock.sendMessage(jid, { text: `🎙️ Generando audio con la voz de *${voz.title}*...` });

    let urlAudio;
    try {
      urlAudio = await generarAudio(voz.model_token, mensaje);
    } catch (err) {
      console.error(err);
      return sock.sendMessage(jid, { text: `No se pudo generar el audio: ${err.message}` });
    }

    const wavPath = path.join(os.tmpdir(), `animevoz_${Date.now()}.wav`);
    const oggPath = path.join(os.tmpdir(), `animevoz_${Date.now()}.ogg`);

    try {
      const resAudio = await fetch(urlAudio);
      const buffer = Buffer.from(await resAudio.arrayBuffer());
      fs.writeFileSync(wavPath, buffer);

      // WhatsApp requiere OGG/Opus para notas de voz (ptt), no WAV/MP3 directo.
      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i "${wavPath}" -c:a libopus -b:a 32k -y "${oggPath}"`, (error) => {
          error ? reject(error) : resolve();
        });
      });

      const oggBuffer = fs.readFileSync(oggPath);
      await sock.sendMessage(jid, { audio: oggBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      await sock.sendMessage(jid, { text: `🎧 Voz: *${voz.title}*` });

      fs.unlinkSync(wavPath);
      fs.unlinkSync(oggPath);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Se genero el audio pero no se pudo convertir/enviar.' });
    }
  }
};

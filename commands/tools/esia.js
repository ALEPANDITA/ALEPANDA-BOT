const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getApiKey } = require('../../lib/apikeys');
const { execFile } = require('child_process');
const util = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const execFileAsync = util.promisify(execFile);

// Usa la API de Sightengine (https://sightengine.com) para estimar si una
// imagen o video fue generado por IA. Requiere una cuenta gratuita:
// 1. Crea una cuenta en https://sightengine.com (plan gratis: 2000 checks/mes)
// 2. En tu dashboard, copia el "API User" y el "API Secret"
// 3. En el bot, ejecuta:
//      .setapikey sightengine_user TU_API_USER
//      .setapikey sightengine_secret TU_API_SECRET

function obtenerMediaCitada(msg) {
  const citado = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const fuente = citado || msg.message;
  if (!fuente) return null;

  if (fuente.imageMessage) return { tipo: 'imagen', mensaje: { message: fuente } };
  if (fuente.videoMessage) return { tipo: 'video', mensaje: { message: fuente } };
  return null;
}

async function consultarSightengine(tipo, rutaArchivo, apiUser, apiSecret) {
  const endpoint = tipo === 'imagen'
    ? 'https://api.sightengine.com/1.0/check.json'
    : 'https://api.sightengine.com/1.0/video/check-sync.json';

  const { stdout } = await execFileAsync('curl', [
    '-s',
    '-X', 'POST', endpoint,
    '-F', `media=@${rutaArchivo}`,
    '-F', 'models=genai',
    '-F', `api_user=${apiUser}`,
    '-F', `api_secret=${apiSecret}`
  ], { maxBuffer: 1024 * 1024 * 20 });

  return JSON.parse(stdout);
}

// El video (check-sync) devuelve el resultado organizado por "frames"; la imagen
// devuelve el resultado directo en "type". Aqui sacamos un solo puntaje 0-1 de cualquiera.
function extraerPuntaje(data, tipo) {
  if (tipo === 'imagen') {
    return data?.type?.ai_generated ?? null;
  }

  const frames = data?.data?.frames || data?.frames || [];
  if (!frames.length) return null;

  const puntajes = frames.map(f => f?.type?.ai_generated).filter(p => typeof p === 'number');
  if (!puntajes.length) return null;

  return Math.max(...puntajes);
}

module.exports = {
  name: 'esia',
  aliases: ['detectarIA', 'esiagenerado'],
  category: 'tools',
  description: 'Analiza una imagen o video (respondiendo a el) y estima si fue generado por IA.',
  execute: async (sock, jid, msg, { prefix }) => {
    const apiUser = getApiKey('sightengine_user');
    const apiSecret = getApiKey('sightengine_secret');

    if (!apiUser || !apiSecret) {
      return sock.sendMessage(jid, {
        text: `⚠️ Este comando necesita una clave de Sightengine configurada.\n\n` +
          `1. Crea una cuenta gratis en https://sightengine.com\n` +
          `2. Copia tu "API User" y tu "API Secret" del dashboard\n` +
          `3. Configura con:\n   ${prefix}setapikey sightengine_user TU_API_USER\n   ${prefix}setapikey sightengine_secret TU_API_SECRET`
      }, { quoted: msg });
    }

    const media = obtenerMediaCitada(msg);
    if (!media) {
      return sock.sendMessage(jid, {
        text: `Responde a una imagen o video con ${prefix}esia para analizarlo.`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: '🔎 Analizando, dame unos segundos...' }, { quoted: msg });

    const extension = media.tipo === 'imagen' ? 'jpg' : 'mp4';
    const rutaTemp = path.join(os.tmpdir(), `esia-${Date.now()}.${extension}`);

    try {
      const buffer = await downloadMediaMessage(media.mensaje, 'buffer', {});
      fs.writeFileSync(rutaTemp, buffer);

      const data = await consultarSightengine(media.tipo, rutaTemp, apiUser, apiSecret);

      if (data?.status !== 'success') {
        const razon = data?.error?.message || 'Respuesta invalida del servicio.';
        return sock.sendMessage(jid, { text: `❌ No se pudo analizar el ${media.tipo}: ${razon}` }, { quoted: msg });
      }

      const puntaje = extraerPuntaje(data, media.tipo);
      if (puntaje === null) {
        return sock.sendMessage(jid, { text: `❌ El servicio no devolvio un puntaje claro para este ${media.tipo}.` }, { quoted: msg });
      }

      const porcentaje = Math.round(puntaje * 100);
      let veredicto;
      if (porcentaje >= 70) veredicto = '🤖 Muy probablemente generado por IA';
      else if (porcentaje >= 40) veredicto = '🤔 Podria tener partes generadas o editadas con IA';
      else veredicto = '📷 Parece contenido real (no generado por IA)';

      await sock.sendMessage(jid, {
        text: `*RESULTADO DEL ANALISIS*\n\n` +
          `${veredicto}\n` +
          `📊 Probabilidad de IA: *${porcentaje}%*\n\n` +
          `_Este resultado es una estimacion, ningun detector de IA es 100% exacto._`
      }, { quoted: msg });
    } catch (err) {
      console.error('[esia] Error:', err);
      await sock.sendMessage(jid, { text: `❌ Ocurrio un error al analizar el ${media.tipo}.` }, { quoted: msg });
    } finally {
      if (fs.existsSync(rutaTemp)) fs.unlinkSync(rutaTemp);
    }
  }
};

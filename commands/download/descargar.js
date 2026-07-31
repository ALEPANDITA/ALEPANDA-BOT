const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns').promises;
const net = require('net');

const LIMITE_MB = 90; // limite de WhatsApp es ~100MB, dejamos margen
const TIMEOUT_MS = 60000; // 60s: si el link no responde en ese tiempo, se cancela
const MAX_REDIRECTS = 5;

const PLATAFORMAS = [
  { patron: /youtu\.?be/i, comando: 'ytmp3 / ytmp4' },
  { patron: /tiktok\.com/i, comando: 'tiktok' },
  { patron: /(facebook\.com|fb\.watch)/i, comando: 'facebook' },
  { patron: /instagram\.com/i, comando: 'ig' },
  { patron: /pinterest\./i, comando: 'pinterest' },
  { patron: /mediafire\.com/i, comando: 'mediafire' },
  { patron: /spotify\.com/i, comando: 'spotify' }
];

// Evita que alguien use el comando para "descargar" cosas de la red interna
// del servidor (localhost, IPs privadas, etc.) - riesgo de seguridad (SSRF).
function esIpPrivada(ip) {
  if (net.isIPv6(ip)) {
    const ipNorm = ip.toLowerCase();
    return ipNorm === '::1' || ipNorm.startsWith('fc') || ipNorm.startsWith('fd') || ipNorm.startsWith('fe80');
  }

  const partes = ip.split('.').map(Number);
  if (partes.length !== 4 || partes.some(n => Number.isNaN(n))) return true;

  const [a, b] = partes;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

async function validarUrlSegura(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten links http o https.');
  }

  const resultados = await dns.lookup(parsed.hostname, { all: true });
  for (const { address } of resultados) {
    if (esIpPrivada(address)) {
      throw new Error('Ese link apunta a una direccion no permitida.');
    }
  }
}

async function fetchSeguro(url, intentos = 0) {
  if (intentos > MAX_REDIRECTS) throw new Error('Demasiadas redirecciones.');

  await validarUrlSegura(url);

  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const ubicacion = res.headers.get('location');
    if (!ubicacion) throw new Error('Redireccion sin destino.');
    const siguienteUrl = new URL(ubicacion, url).toString();
    return fetchSeguro(siguienteUrl, intentos + 1);
  }

  return res;
}

function adivinarNombreYExtension(url, contentType) {
  try {
    const pathname = new URL(url).pathname;
    let nombre = path.basename(pathname) || 'archivo';

    if (!nombre.includes('.') && contentType) {
      const ext = contentType.split('/')[1]?.split(';')[0];
      if (ext) nombre += `.${ext}`;
    }

    return nombre.includes('.') ? nombre : 'archivo.bin';
  } catch {
    return 'archivo.bin';
  }
}

function payloadSegunTipo(buffer, contentType, nombreArchivo) {
  const tipo = (contentType || '').toLowerCase();

  if (tipo.startsWith('image/')) return { image: buffer };
  if (tipo.startsWith('video/')) return { video: buffer, fileName: nombreArchivo };
  if (tipo.startsWith('audio/')) return { audio: buffer, mimetype: tipo, fileName: nombreArchivo };
  return { document: buffer, fileName: nombreArchivo, mimetype: tipo || 'application/octet-stream' };
}

module.exports = {
  name: 'descargar',
  aliases: ['dl', 'download'],
  category: 'download',
  description: 'Descarga un archivo directo: PDF, ZIP, imagen, video, audio, etc. Uso: .descargar <link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = texto.trim().split(/\s+/);
    const url = partes[1];

    if (!url || !url.startsWith('http')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}descargar <link>\nEjemplo: ${prefix}descargar https://ejemplo.com/archivo.pdf` });
    }

    const plataforma = PLATAFORMAS.find(p => p.patron.test(url));
    if (plataforma) {
      return sock.sendMessage(jid, {
        text: `Ese link es de una plataforma con comando propio. Usa:\n${prefix}${plataforma.comando} ${url}`
      });
    }

    await sock.sendMessage(jid, { text: '🔎 Descargando el archivo...' }, { quoted: msg });

    try {
      const res = await fetchSeguro(url);

      if (!res.ok) {
        return sock.sendMessage(jid, { text: `El servidor respondio con error (HTTP ${res.status}).` }, { quoted: msg });
      }

      const largoDeclarado = Number(res.headers.get('content-length') || 0);
      if (largoDeclarado && largoDeclarado > LIMITE_MB * 1024 * 1024) {
        return sock.sendMessage(jid, { text: `El archivo pesa mas de ${LIMITE_MB}MB, no se puede enviar por WhatsApp.` }, { quoted: msg });
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      if (buffer.length > LIMITE_MB * 1024 * 1024) {
        return sock.sendMessage(jid, { text: `El archivo pesa mas de ${LIMITE_MB}MB, no se puede enviar por WhatsApp.` }, { quoted: msg });
      }

      const contentType = res.headers.get('content-type');
      const nombreArchivo = adivinarNombreYExtension(url, contentType);
      const payload = payloadSegunTipo(buffer, contentType, nombreArchivo);

      await sock.sendMessage(jid, payload, { quoted: msg });
    } catch (err) {
      console.error('[descargar]', err);
      const mensaje = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'El link tardo demasiado en responder (mas de 60s), se cancelo.'
        : err.message?.includes('no permitida') || err.message?.includes('http o https')
          ? err.message
          : 'No se pudo descargar ese link. Verifica que sea publico y accesible.';
      await sock.sendMessage(jid, { text: mensaje }, { quoted: msg });
    }
  }
};

const fs = require('fs');
const path = require('path');
const os = require('os');

const LIMITE_MB = 90; // limite de WhatsApp es ~100MB, dejamos margen

const PLATAFORMAS = [
  { patron: /youtu\.?be/i, comando: 'ytmp3 / ytmp4' },
  { patron: /tiktok\.com/i, comando: 'tiktok' },
  { patron: /(facebook\.com|fb\.watch)/i, comando: 'facebook' },
  { patron: /instagram\.com/i, comando: 'ig' },
  { patron: /pinterest\./i, comando: 'pinterest' },
  { patron: /mediafire\.com/i, comando: 'mediafire' },
  { patron: /spotify\.com/i, comando: 'spotify' }
];

function descargaDirecta(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return reject(new Error(`HTTP ${res.status}`));
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function adivinarNombreYExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const nombre = path.basename(pathname) || 'archivo';
    return nombre.includes('.') ? nombre : `${nombre}.bin`;
  } catch {
    return 'archivo.bin';
  }
}

module.exports = {
  name: 'descargar',
  aliases: ['dl', 'download'],
  category: 'download',
  description: 'Descarga un archivo directo: PDF, ZIP, imagen, etc. Uso: .descargar <link>',
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

    await sock.sendMessage(jid, { text: '🔎 Descargando el archivo...' });

    const nombreArchivo = adivinarNombreYExtension(url);
    const rutaDirecta = path.join(os.tmpdir(), `descargar_${Date.now()}_${nombreArchivo}`);

    try {
      await descargaDirecta(url, rutaDirecta);
      const stats = fs.statSync(rutaDirecta);

      if (stats.size > LIMITE_MB * 1024 * 1024) {
        fs.unlinkSync(rutaDirecta);
        return sock.sendMessage(jid, { text: `El archivo pesa mas de ${LIMITE_MB}MB, no se puede enviar por WhatsApp.` });
      }

      const buffer = fs.readFileSync(rutaDirecta);
      await sock.sendMessage(jid, { document: buffer, fileName: nombreArchivo });
      fs.unlinkSync(rutaDirecta);
    } catch (err) {
      console.error('[descargar]', err);
      await sock.sendMessage(jid, { text: 'No se pudo descargar ese link. Verifica que sea publico y accesible.' });
    }
  }
};

const fs = require('fs');
const path = require('path');
const os = require('os');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

async function extraerImagenDePin(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!res.ok) throw new Error(`No se pudo abrir el link (HTTP ${res.status}).`);

  const html = await res.text();
  const match = html.match(/<meta property="og:image" content="([^"]+)"/i);

  if (!match) throw new Error('No se encontro ninguna imagen en ese link.');
  return match[1];
}

module.exports = {
  name: 'pinterest',
  aliases: ['pin'],
  category: 'download',
  description: 'Descarga una imagen de un pin de Pinterest. Uso: .pinterest <link del pin>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.trim().split(/\s+/)[1];

    if (!url || !/pinterest\.|pin\.it/.test(url)) {
      return sock.sendMessage(jid, { text: advertencia(`Uso: ${prefix}pinterest <link del pin>`, { titulo: 'PINTEREST' }) });
    }

    await sock.sendMessage(jid, { text: cargando('Buscando la imagen del pin...', { titulo: 'PINTEREST' }) });

    let tempPath;
    try {
      const imagenUrl = await extraerImagenDePin(url);
      const res = await fetch(imagenUrl);
      const buffer = Buffer.from(await res.arrayBuffer());

      tempPath = path.join(os.tmpdir(), `pinterest_${Date.now()}.jpg`);
      fs.writeFileSync(tempPath, buffer);

      await sock.sendMessage(jid, { image: buffer });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: cajaError(`No se pudo descargar: ${err.message}`) });
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
};

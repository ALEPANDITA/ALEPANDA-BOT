const PDFDocument = require('pdfkit');
const Jimp = require('jimp');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function descargarBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = {
  name: 'webtoonep',
  category: 'download',
  description: 'Descarga un episodio de Webtoons completo como un solo PDF',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const url = texto.slice((prefix + 'webtoonep ').length).trim();

    if (!url || !url.includes('webtoons.com')) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}webtoonep <link del capitulo de webtoons>` });
    }

    let paginas;
    try {
      const res = await fetch(`https://api.delirius.store/download/wbdl?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!json.status || !json.data?.length) throw new Error('Respuesta invalida');
      paginas = json.data;
    } catch (err) {
      console.error('[webtoonep]', err);
      return sock.sendMessage(jid, { text: 'No se pudo leer ese capitulo.' });
    }

    await sock.sendMessage(jid, { text: `📖 Armando PDF con ${paginas.length} paginas, esto puede tardar un rato...` });

    const nombreArchivo = `webtoon_${Date.now()}.pdf`;
    const rutaPdf = path.join(os.tmpdir(), nombreArchivo);

    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const streamSalida = fs.createWriteStream(rutaPdf);
      doc.pipe(streamSalida);

      for (let i = 0; i < paginas.length; i++) {
        try {
          const buffer = await descargarBuffer(paginas[i]);
          const imagen = await Jimp.read(buffer);
          const { width, height } = imagen.bitmap;

          doc.addPage({ size: [width, height] });
          doc.image(buffer, 0, 0, { width, height });
        } catch (err) {
          console.error(`[webtoonep] fallo pagina ${i + 1}:`, err.message);
        }
      }

      doc.end();
      await new Promise((resolve, reject) => {
        streamSalida.on('finish', resolve);
        streamSalida.on('error', reject);
      });

      const bufferPdf = fs.readFileSync(rutaPdf);
      await sock.sendMessage(jid, {
        document: bufferPdf,
        mimetype: 'application/pdf',
        fileName: `${nombreArchivo}`
      });

      fs.unlinkSync(rutaPdf);
    } catch (err) {
      console.error('[webtoonep]', err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al armar el PDF.' });
    }
  }
};

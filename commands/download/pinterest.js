const { buscarPinterest, enviarPin, enviarImagenesDeBusqueda } = require('../../lib/pinterestapi');
const { guardarBusqueda } = require('../../lib/busquedas');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

const CUANTAS = 6; // imagenes que se mandan por busqueda

module.exports = {
  name: 'pinterest',
  aliases: ['pin'],
  category: 'download',
  description: `Busca en Pinterest y manda ${CUANTAS} imagenes directo al chat, o descarga un pin con su link. Uso: .pinterest <busqueda o link>`,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = texto.trim().split(/\s+/).slice(1).join(' ').trim();

    if (!input) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}pinterest <busqueda> (o pega el link de un pin)`, { titulo: 'PINTEREST' })
      });
    }

    // Link directo: descarga inmediata de ese pin
    if (/pinterest\.|pin\.it/.test(input)) {
      await sock.sendMessage(jid, { text: cargando('Descargando el pin...', { titulo: 'PINTEREST' }) });
      try {
        await enviarPin(sock, jid, input, { quoted: msg });
      } catch (err) {
        console.error('[pinterest]', err);
        const textoError = err.code === 'NO_API_KEY' ? err.message : `No se pudo descargar: ${err.message}`;
        await sock.sendMessage(jid, { text: cajaError(textoError) });
      }
      return;
    }

    await sock.sendMessage(jid, { text: cargando(`Buscando *${input}* en Pinterest...`, { titulo: 'PINTEREST' }) });

    // Se piden mas resultados de los que se mandan: si alguna imagen no baja, otra la reemplaza
    let resultados = [];
    try {
      resultados = await buscarPinterest(input, CUANTAS * 2);
    } catch (err) {
      console.error('[pinterest]', err);
      const textoError = err.code === 'NO_API_KEY' ? err.message : `No se pudo buscar en Pinterest: ${err.message}`;
      return sock.sendMessage(jid, { text: cajaError(textoError) });
    }

    if (!resultados.length) {
      return sock.sendMessage(jid, { text: 'No se encontraron resultados en Pinterest.' });
    }

    let enviados = [];
    try {
      enviados = await enviarImagenesDeBusqueda(sock, jid, resultados, { cantidad: CUANTAS, quoted: msg });
    } catch (err) {
      console.error('[pinterest]', err);
    }

    if (!enviados.length) {
      return sock.sendMessage(jid, { text: cajaError('Encontre resultados, pero no pude bajar ninguna imagen. Intenta de nuevo en un momento.') });
    }

    // Para que ".pindl <numero>" siga funcionando con lo que se acaba de mandar (1/6, 2/6...)
    guardarBusqueda(jid, enviados);
  }
};

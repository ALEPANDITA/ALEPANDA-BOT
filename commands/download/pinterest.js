const { buscarPinterest, enviarPin } = require('../../lib/pinterestapi');
const { guardarBusqueda } = require('../../lib/busquedas');
const { enviarCarrusel } = require('../../lib/carrusel');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pinterest',
  aliases: ['pin'],
  category: 'download',
  description: 'Busca en Pinterest (carrusel deslizable) o descarga un pin directo. Uso: .pinterest <busqueda o link>',
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

    let resultados = [];
    try {
      resultados = await buscarPinterest(input, 6);
    } catch (err) {
      console.error('[pinterest]', err);
      const textoError = err.code === 'NO_API_KEY' ? err.message : `No se pudo buscar en Pinterest: ${err.message}`;
      return sock.sendMessage(jid, { text: cajaError(textoError) });
    }

    if (!resultados.length) {
      return sock.sendMessage(jid, { text: 'No se encontraron resultados en Pinterest.' });
    }

    guardarBusqueda(jid, resultados);

    const acortar = (t, max = 55) => (t && t.length > max ? t.slice(0, max - 3) + '...' : (t || 'Pin sin titulo'));

    // 1) Carrusel deslizable (una tarjeta por pin)
    try {
      await enviarCarrusel(sock, jid, msg, {
        texto: `📌 Resultados para: *${input}* (desliza para ver mas)`,
        footer: 'ALEPANDA BOT',
        titulo: 'Pinterest',
        subtitulo: input,
        tarjetas: resultados.map((p, i) => ({
          imagen: p.image,
          titulo: acortar(p.title, 60),
          texto: `Resultado ${i + 1} de ${resultados.length}`,
          botones: [{ texto: '📌 Descargar', id: `${prefix}pindl ${i + 1}` }]
        }))
      });
      console.log('[pinterest] Carrusel enviado.');
      return;
    } catch (err) {
      console.warn('[pinterest] El carrusel fallo, mando la lista. Detalle:', err.message);
    }

    // 2) Respaldo: lista en texto + menu desplegable nativo
    const listado = resultados.map((p, i) => `*${i + 1}.* ${acortar(p.title)}\n⬇️ ${prefix}pindl ${i + 1}`).join('\n\n');
    await sock.sendMessage(jid, { text: `📌 Resultados para: *${input}*\n\n${listado}` }, { quoted: msg });

    try {
      await sock.sendMessage(jid, {
        text: 'Elige un pin para descargar 👇',
        footer: 'ALEPANDA BOT',
        title: 'Pinterest',
        buttons: [{
          text: '📌 Descargar pin',
          sections: [{
            title: 'Resultados',
            rows: resultados.map((p, i) => ({ title: `${i + 1}. ${acortar(p.title, 40)}`, description: 'Pinterest', id: `${prefix}pindl ${i + 1}` }))
          }]
        }]
      }, { quoted: msg });
    } catch (err) {
      console.warn('[pinterest] los botones no se pudieron enviar:', err.message);
    }
  }
};

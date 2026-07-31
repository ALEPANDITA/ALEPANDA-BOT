const { buscarPinterest, enviarPin } = require('../../lib/pinterestapi');
const { guardarBusqueda } = require('../../lib/busquedas');
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

    // Si mandaron un link directo, se mantiene el comportamiento de siempre:
    // descarga inmediata de ese pin, sin pasar por la busqueda.
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

    // Busqueda por palabra clave -> carrusel deslizable, mismo estilo que .ytsearch
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

    const acortar = (t) => (t && t.length > 55 ? t.slice(0, 52) + '...' : (t || 'Pin sin titulo'));

    // 1) Intento principal: carrusel deslizable (una tarjeta por pin), igual
    // que .ytsearch. Si el cliente/fork no lo soporta, cae al respaldo de abajo.
    let carruselEnviado = false;
    try {
      await sock.sendMessage(jid, {
        text: `📌 Resultados para: *${input}*`,
        footer: 'ALEPANDA BOT',
        title: '🌸 Desliza para ver mas resultados',
        cards: resultados
          .filter(p => p.image)
          .map((p, i) => ({
            image: { url: p.image },
            title: acortar(p.title),
            body: `Resultado ${i + 1} de ${resultados.length}`,
            footer: 'Pinterest',
            buttons: [
              { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📌 Descargar', id: `${prefix}pindl ${i + 1}` }) }
            ]
          }))
      }, { quoted: msg });
      carruselEnviado = true;
      console.log('[pinterest] Carrusel deslizable enviado correctamente.');
    } catch (err) {
      console.warn('[pinterest] El carrusel deslizable no se pudo enviar:', err.message);
    }

    if (carruselEnviado) return;

    // 2) Respaldo: texto con la lista + miniaturas sueltas + lista interactiva.
    const listado = resultados.map((p, i) => `*${i + 1}.* ${acortar(p.title)}\n⬇️ ${prefix}pindl ${i + 1}`).join('\n\n');
    await sock.sendMessage(jid, { text: `📌 Resultados para: *${input}*\n\n${listado}` });

    for (let i = 0; i < resultados.length; i++) {
      const p = resultados[i];
      try {
        if (p.image) await sock.sendMessage(jid, { image: { url: p.image }, caption: `${i + 1}` });
      } catch (err) {
        console.error(`[pinterest] error enviando miniatura ${i + 1}:`, err.message);
      }
    }

    try {
      await sock.sendMessage(jid, {
        text: 'Tambien puedes elegir aqui abajo 👇',
        footer: 'ALEPANDA BOT',
        title: 'Descargar un resultado',
        buttonText: 'Ver opciones',
        sections: [{
          title: '📌 Descargar pin',
          rows: resultados.map((p, i) => ({ title: `${i + 1}. ${acortar(p.title)}`, rowId: `${prefix}pindl ${i + 1}` }))
        }]
      });
    } catch (err) {
      console.warn('[pinterest] la lista interactiva no se pudo enviar:', err.message);
    }
  }
};

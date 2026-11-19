const { enviarPin } = require('../../lib/pinterestapi');
const { obtenerBusqueda } = require('../../lib/busquedas');
const { cargando, advertencia, error: cajaError } = require('../../lib/estilo');

module.exports = {
  name: 'pindl',
  category: 'download',
  description: 'Descarga un pin de la ultima busqueda de .pinterest. Uso: .pindl <numero o link>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const input = texto.trim().split(/\s+/).slice(1).join(' ').trim();

    if (!input) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}pindl <numero de ${prefix}pinterest, o un link de pin>`, { titulo: 'FALTA INFORMACION' })
      });
    }

    let pinUrl = input;
    let extra = {};
    if (/^\d+$/.test(input)) {
      const deLaBusqueda = obtenerBusqueda(jid, input);
      if (!deLaBusqueda) {
        return sock.sendMessage(jid, {
          text: advertencia(`No hay una busqueda reciente con ese numero. Usa ${prefix}pinterest primero.`, { titulo: 'SIN RESULTADOS' })
        });
      }
      pinUrl = deLaBusqueda.url;
      // la busqueda ya trae la imagen en buena calidad: se baja directo (los pines "e1_..." no siempre salen por la API de descarga)
      extra = { directas: deLaBusqueda.full, titulo: deLaBusqueda.title };
    }

    await sock.sendMessage(jid, { text: cargando('Descargando el pin...', { titulo: 'PINDL' }) });

    try {
      await enviarPin(sock, jid, pinUrl, { quoted: msg, ...extra });
    } catch (err) {
      console.error('[pindl]', err);
      const textoError = err.code === 'NO_API_KEY' ? err.message : `No se pudo descargar: ${err.message}`;
      await sock.sendMessage(jid, { text: cajaError(textoError) });
    }
  }
};

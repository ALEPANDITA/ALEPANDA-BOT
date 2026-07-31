const { listarPeliculas, eliminarPelicula, estaViva } = require('../../lib/pelis');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja } = require('../../lib/estilo');

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Revision manual del catalogo completo: usa un chequeo LIGERO (solo el
// primer pedacito del stream de cada video, no el archivo completo) para
// confirmar que cada pelicula sigue viva, y borra las que ya no sirvan.
// Como solo lee un pedacito por pelicula, revisar 40 peliculas no gasta
// mucha mas RAM/datos que revisar 1.
module.exports = {
  name: 'pelischeck',
  category: 'owner',
  description: 'Solo owner: revisa TODO el catalogo de peliculas (chequeo ligero) y borra las que ya no sirvan.',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    const peliculas = listarPeliculas();
    if (peliculas.length === 0) {
      return sock.sendMessage(jid, {
        text: caja(['El catalogo esta vacio, no hay nada que revisar.'], { titulo: 'PELISCHECK', estilo: 'gamer' })
      });
    }

    await sock.sendMessage(jid, {
      text: caja(
        [`Revisando ${peliculas.length} peliculas (chequeo ligero, solo el inicio de cada una)...`],
        { titulo: '🔍 PELISCHECK INICIADO', estilo: 'gamer' }
      )
    }, { quoted: msg });

    let vivas = 0;
    const eliminadas = [];

    for (const pelicula of peliculas) {
      const viva = await estaViva(pelicula);
      if (viva) {
        vivas++;
      } else {
        eliminarPelicula(pelicula.numero);
        eliminadas.push(`#${pelicula.numero} ${pelicula.nombre}`);
      }
      // Pausa cortita entre cada una, mas por prudencia que por necesidad
      // real (el chequeo ligero ya es barato de por si).
      await esperar(400);
    }

    const lineas = [
      `✅ Vivas: ${vivas}`,
      `🗑️ Eliminadas: ${eliminadas.length}`
    ];
    if (eliminadas.length > 0) {
      lineas.push('', ...eliminadas.slice(0, 30));
      if (eliminadas.length > 30) lineas.push(`... y ${eliminadas.length - 30} mas`);
    }

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: '🔍 PELISCHECK TERMINADO', estilo: 'gamer' })
    });
  }
};

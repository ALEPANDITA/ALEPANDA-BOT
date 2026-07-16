const { guardarDB, getUsuario } = require('./db');
const { EMOJI_RAREZA } = require('./gachaanime');

function asegurarMercadoAnime(db) {
  if (!db.mercadoAnime) db.mercadoAnime = { ventas: {}, subastas: {} };
  if (!db.mercadoAnime.ventas) db.mercadoAnime.ventas = {};
  if (!db.mercadoAnime.subastas) db.mercadoAnime.subastas = {};
  return db.mercadoAnime;
}

async function finalizarSubastasVencidasAnime(sock, db) {
  const mercado = asegurarMercadoAnime(db);
  const ahora = Date.now();
  let huboCambios = false;

  for (const id of Object.keys(mercado.subastas)) {
    const subasta = mercado.subastas[id];
    if (subasta.estado !== 'activa' || ahora < subasta.finalizaEn) continue;

    huboCambios = true;
    const vendedorPerfil = getUsuario(db, subasta.vendedor);
    let mensaje;

    if (subasta.mejorPostor) {
      vendedorPerfil.saldo += subasta.precioActual;
      const ganadorPerfil = getUsuario(db, subasta.mejorPostor);
      if (!ganadorPerfil.gachaAnime) ganadorPerfil.gachaAnime = {};
      ganadorPerfil.gachaAnime[subasta.nombre] = (ganadorPerfil.gachaAnime[subasta.nombre] || 0) + 1;

      mensaje =
        `🔨 *¡Subasta anime finalizada!*\n\n` +
        `${EMOJI_RAREZA[subasta.rareza]} *${subasta.nombre}*\n` +
        `🏆 Ganador: @${subasta.mejorPostor.split('@')[0]}\n` +
        `💰 Precio final: $${subasta.precioActual}\n` +
        `👤 Vendedor: @${subasta.vendedor.split('@')[0]}`;
    } else {
      if (!vendedorPerfil.gachaAnime) vendedorPerfil.gachaAnime = {};
      vendedorPerfil.gachaAnime[subasta.nombre] = (vendedorPerfil.gachaAnime[subasta.nombre] || 0) + 1;

      mensaje =
        `🔨 *Subasta anime finalizada sin pujas*\n\n` +
        `${EMOJI_RAREZA[subasta.rareza]} *${subasta.nombre}* volvio a manos de @${subasta.vendedor.split('@')[0]}.`;
    }

    delete mercado.subastas[id];

    if (sock && subasta.jid) {
      try {
        const mentions = subasta.mejorPostor ? [subasta.vendedor, subasta.mejorPostor] : [subasta.vendedor];
        await sock.sendMessage(subasta.jid, { text: mensaje, mentions });
      } catch (err) {
        console.error('[mercadoanime] No se pudo anunciar el fin de subasta:', err);
      }
    }
  }

  if (huboCambios) guardarDB(db);
}

module.exports = { asegurarMercadoAnime, finalizarSubastasVencidasAnime };

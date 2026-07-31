const { guardarDB, getUsuario } = require('./db');
const { EMOJI_RAREZA } = require('./gachahp');

function asegurarMercado(db) {
  if (!db.mercado) db.mercado = { ventas: {}, subastas: {} };
  if (!db.mercado.ventas) db.mercado.ventas = {};
  if (!db.mercado.subastas) db.mercado.subastas = {};
  return db.mercado;
}

function generarId(prefijo) {
  return `${prefijo}${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

function formatoTiempo(ms) {
  if (ms <= 0) return '0s';
  const totalSeg = Math.ceil(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return min > 0 ? `${min}m ${seg}s` : `${seg}s`;
}

// Revisa todas las subastas activas y cierra las que ya vencieron.
// Paga al vendedor, entrega el personaje al ganador (o lo devuelve si nadie pujo),
// y avisa en el chat donde se creo la subasta.
async function finalizarSubastasVencidas(sock, db) {
  const mercado = asegurarMercado(db);
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
      if (!ganadorPerfil.gachaHP) ganadorPerfil.gachaHP = {};
      ganadorPerfil.gachaHP[subasta.nombre] = (ganadorPerfil.gachaHP[subasta.nombre] || 0) + 1;

      mensaje =
        `🔨 *¡Subasta finalizada!*\n\n` +
        `${EMOJI_RAREZA[subasta.rareza]} *${subasta.nombre}*\n` +
        `🏆 Ganador: @${subasta.mejorPostor.split('@')[0]}\n` +
        `💰 Precio final: $${subasta.precioActual}\n` +
        `👤 Vendedor: @${subasta.vendedor.split('@')[0]}`;
    } else {
      if (!vendedorPerfil.gachaHP) vendedorPerfil.gachaHP = {};
      vendedorPerfil.gachaHP[subasta.nombre] = (vendedorPerfil.gachaHP[subasta.nombre] || 0) + 1;

      mensaje =
        `🔨 *Subasta finalizada sin pujas*\n\n` +
        `${EMOJI_RAREZA[subasta.rareza]} *${subasta.nombre}* volvio a manos de @${subasta.vendedor.split('@')[0]}.`;
    }

    delete mercado.subastas[id];

    if (sock && subasta.jid) {
      try {
        const mentions = subasta.mejorPostor ? [subasta.vendedor, subasta.mejorPostor] : [subasta.vendedor];
        await sock.sendMessage(subasta.jid, { text: mensaje, mentions });
      } catch (err) {
        console.error('[mercado] No se pudo anunciar el fin de subasta:', err);
      }
    }
  }

  if (huboCambios) guardarDB(db);
}

module.exports = { asegurarMercado, generarId, formatoTiempo, finalizarSubastasVencidas };

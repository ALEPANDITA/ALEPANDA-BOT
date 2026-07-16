const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { asegurarMercado, finalizarSubastasVencidas, formatoTiempo } = require('../../lib/mercado');

module.exports = {
  name: 'pujarhp',
  category: 'gacha',
  description: 'Puja por un personaje en subasta. Uso: .pujarhp <ID> <monto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];
    const monto = parseInt(args[1]);

    if (!id || !monto || monto <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}pujarhp <ID> <monto>` }, { quoted: msg });
    }

    let db = leerDB();

    // Por si esta subasta (u otras) ya vencieron y nadie las cerro todavia
    await finalizarSubastasVencidas(sock, db);
    db = leerDB();

    const mercado = asegurarMercado(db);
    const subasta = mercado.subastas[id];

    if (!subasta) {
      return sock.sendMessage(jid, { text: 'Esa subasta no existe o ya termino.' }, { quoted: msg });
    }

    if (subasta.vendedor === remitente) {
      return sock.sendMessage(jid, { text: 'No puedes pujar en tu propia subasta.' }, { quoted: msg });
    }

    if (monto <= subasta.precioActual) {
      return sock.sendMessage(jid, { text: `Tu puja debe ser mayor a $${subasta.precioActual}.` }, { quoted: msg });
    }

    const postor = getUsuario(db, remitente);

    // Si el mismo usuario ya era el mejor postor, primero se le devuelve lo que tenia apartado
    if (subasta.mejorPostor === remitente) {
      postor.saldo += subasta.precioActual;
    }

    if (postor.saldo < monto) {
      // Revertir el reembolso temporal si no le alcanza para la nueva puja
      if (subasta.mejorPostor === remitente) {
        postor.saldo -= subasta.precioActual;
      }
      return sock.sendMessage(jid, { text: `No tienes suficientes monedas. Necesitas $${monto} y tienes $${postor.saldo}.` }, { quoted: msg });
    }

    // Reembolsar al postor anterior (si era otra persona)
    if (subasta.mejorPostor && subasta.mejorPostor !== remitente) {
      const anterior = getUsuario(db, subasta.mejorPostor);
      anterior.saldo += subasta.precioActual;
    }

    postor.saldo -= monto;
    subasta.precioActual = monto;
    subasta.mejorPostor = remitente;

    guardarDB(db);

    const restante = formatoTiempo(subasta.finalizaEn - Date.now());
    await sock.sendMessage(jid, {
      text:
        `🔨 *¡Nueva puja!*\n\n` +
        `${subasta.emoji} *${subasta.nombre}*\n` +
        `💰 Puja actual: $${monto} (de @${remitente.split('@')[0]})\n` +
        `⏳ Tiempo restante: ${restante}`,
      mentions: [remitente]
    }, { quoted: msg });
  }
};

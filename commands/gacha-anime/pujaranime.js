const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { asegurarMercadoAnime, finalizarSubastasVencidasAnime } = require('../../lib/mercadoanime');
const { formatoTiempo } = require('../../lib/mercado');

module.exports = {
  name: 'pujaranime',
  category: 'gacha-anime',
  description: 'Puja por una ilustracion de anime en subasta. Uso: .pujaranime <ID> <monto>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);
    const id = args[0];
    const monto = parseInt(args[1]);

    if (!id || !monto || monto <= 0) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}pujaranime <ID> <monto>` }, { quoted: msg });
    }

    let db = leerDB();
    await finalizarSubastasVencidasAnime(sock, db);
    db = leerDB();

    const mercado = asegurarMercadoAnime(db);
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

    if (subasta.mejorPostor === remitente) {
      postor.saldo += subasta.precioActual;
    }

    if (postor.saldo < monto) {
      if (subasta.mejorPostor === remitente) {
        postor.saldo -= subasta.precioActual;
      }
      return sock.sendMessage(jid, { text: `No tienes suficientes monedas. Necesitas $${monto} y tienes $${postor.saldo}.` }, { quoted: msg });
    }

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

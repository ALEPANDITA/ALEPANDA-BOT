const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { advertencia, exito } = require('../../lib/estilo');

const VALOR_POR_RAREZA = { COMUN: 100, RARA: 300, EPICA: 800, LEGENDARIA: 2000 };

module.exports = {
  name: 'vender',
  category: 'gacha',
  description: 'Vende un personaje de tu harem por dinero. Uso: .vender <numero del harem>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const indice = parseInt(partes[1], 10);

    if (!indice || indice < 1) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}vender <numero> (revisa el numero con .harem)`, { titulo: 'VENDER' })
      });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const orden = { LEGENDARIA: 0, EPICA: 1, RARA: 2, COMUN: 3 };
    const ordenados = [...usuario.waifus].sort((a, b) => orden[a.rareza] - orden[b.rareza]);
    const elegido = ordenados[indice - 1];

    if (!elegido) {
      return sock.sendMessage(jid, { text: advertencia('No tienes ningun personaje con ese numero.', { titulo: 'VENDER' }) });
    }

    const valor = VALOR_POR_RAREZA[elegido.rareza] || 100;

    usuario.waifus = usuario.waifus.filter(w => !(w.id === elegido.id && w.fecha === elegido.fecha));
    usuario.saldo += valor;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Vendiste a *${elegido.nombre}* por *$${valor}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'VENDIDO', pie: 'ALEPANDA GACHA' })
    });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { advertencia, exito } = require('../../lib/estilo');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const C = require('../../lib/cartasbot');

const VALOR_POR_RAREZA = { COMUN: 100, RARA: 300, EPICA: 800, LEGENDARIA: 2000 };

module.exports = {
  name: 'vender',
  category: 'gacha',
  description: 'Vende al bot: un personaje del harem (.vender <numero>) o cartas de anime (.vender <nombre> [cantidad] | .vender duplicadas)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const args = partes.slice(1);
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });

    // ---- Cartas de anime: el bot las compra al instante y se las queda ----
    if (args.length && !/^\d+$/.test(args[0])) {
      const db = leerDB();
      const perfil = getUsuario(db, remitente);
      if (!perfil.gachaAnime) perfil.gachaAnime = {};
      if (!perfil.gachaAnimeFotos) perfil.gachaAnimeFotos = {};

      const pagarYGuardar = (carta, n) => {
        perfil.gachaAnime[carta.nombre] -= n;
        if (perfil.gachaAnime[carta.nombre] <= 0) delete perfil.gachaAnime[carta.nombre];
        const pago = n * C.precioCompraBot(carta.rareza);
        perfil.saldo += pago;
        C.agregarAlBot(db, carta, n, perfil.gachaAnimeFotos[carta.nombre]);
        return pago;
      };

      // .vender duplicadas -> vende lo repetido y deja 1 de cada una
      if (/^(duplicadas|repetidas|duplicados|repetidos)$/i.test(args[0])) {
        const vendidas = []; let total = 0;
        for (const [nombre, cant] of Object.entries({ ...perfil.gachaAnime })) {
          const carta = C.buscarCarta(nombre);
          if (!carta || carta.ambiguo || cant < 2) continue;
          const n = cant - 1;
          total += pagarYGuardar(carta, n);
          vendidas.push(`${EMOJI_RAREZA[carta.rareza]} ${carta.nombre} x${n}`);
        }
        if (!vendidas.length) return responder('No tienes cartas repetidas para vender.');
        guardarDB(db);
        return responder(`💰 *Vendiste tus duplicadas al bot*\n\n${vendidas.join('\n')}\n\nGanaste: *$${total}*\n💳 Saldo: $${perfil.saldo}`);
      }

      // .vender <nombre> [cantidad | todas]
      let cantidad = 1; let nombre = args.join(' ');
      const ultimo = args[args.length - 1].toLowerCase();
      if (args.length > 1 && /^\d+$/.test(ultimo)) { cantidad = parseInt(ultimo, 10); nombre = args.slice(0, -1).join(' '); }
      else if (args.length > 1 && /^(todas|todos|todo)$/.test(ultimo)) { cantidad = 'todas'; nombre = args.slice(0, -1).join(' '); }

      const carta = C.buscarCarta(nombre);
      if (!carta) return responder(`No encontré esa carta. Revisa tu colección con *${prefix}coleccionanime*.`);
      if (carta.ambiguo) return responder(`Hay varias que coinciden: ${carta.ambiguo.join(', ')}. Escribe el nombre más completo.`);
      const tengo = perfil.gachaAnime[carta.nombre] || 0;
      if (tengo < 1) return responder(`No tienes a *${carta.nombre}* en tu colección.`);
      const n = cantidad === 'todas' ? tengo : cantidad;
      if (n < 1) return responder('La cantidad tiene que ser mayor a 0.');
      if (n > tengo) return responder(`Solo tienes *${tengo}* de *${carta.nombre}*. No puedes vender ${n}.`);

      const pago = pagarYGuardar(carta, n);
      guardarDB(db);
      return responder(`💰 *Vendido al bot*\n\n${EMOJI_RAREZA[carta.rareza]} ${carta.emoji} *${carta.nombre}* x${n}\nGanaste: *$${pago}* ($${C.precioCompraBot(carta.rareza)} c/u)\n📦 Te quedan: ${tengo - n}\n💳 Saldo: $${perfil.saldo}\n\n🏪 El bot la pone a la venta en *${prefix}mercado bot*`);
    }

    // ---- Personajes del harem (como antes) ----
    const indice = parseInt(partes[1], 10);
    if (!indice || indice < 1) {
      return sock.sendMessage(jid, {
        text: advertencia(`Uso:\n• ${prefix}vender <numero> (personaje del .harem)\n• ${prefix}vender <carta> [cantidad] (ej: ${prefix}vender neko callejera 2)\n• ${prefix}vender duplicadas`, { titulo: 'VENDER' })
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

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { llaveRemitente } = require('../../lib/economiaid');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');
const { descargarImagenBuffer } = require('../../lib/animeapi');
const C = require('../../lib/cartasbot');

const POR_PAGINA = 12;

module.exports = {
  name: 'mercado',
  category: 'gacha-anime',
  description: 'Mercado del bot: .mercado bot (ver sus cartas), .mercado comprar <ID>, .mercado ver <ID>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const args = texto.trim().split(/\s+/).slice(1);
    const sub = (args[0] || '').toLowerCase();
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const buscar = (stock, id) => stock.find((c) => c.id.toLowerCase() === String(id || '').toLowerCase());

    if (sub === 'bot') {
      const db = leerDB();
      const stock = [...C.stockBot(db)].sort((a, b) => C.ORDEN[a.rareza] - C.ORDEN[b.rareza] || b.desde - a.desde);
      if (!stock.length) return responder(`🏪 El bot todavía no tiene cartas.\nVéndele las tuyas con *${prefix}vender <nombre> [cantidad]*.`);
      const paginas = Math.ceil(stock.length / POR_PAGINA);
      const pag = Math.min(paginas, Math.max(1, parseInt(args[1], 10) || 1));
      const lineas = stock.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
        .map((c) => `${EMOJI_RAREZA[c.rareza]} *${c.nombre}* — $${C.precioVentaBot(c.rareza)}  ·  ID: \`${c.id}\``);
      return responder(`🏪 *MERCADO DEL BOT* (${stock.length} cartas)\n\n${lineas.join('\n')}\n\n📄 Página ${pag}/${paginas}${paginas > 1 ? ` · ${prefix}mercado bot ${Math.min(paginas, pag + 1)}` : ''}\n🛒 Compra: ${prefix}mercado comprar <ID>\n🖼️ Ver la imagen: ${prefix}mercado ver <ID>`);
    }

    if (sub === 'ver') {
      const db = leerDB();
      const carta = buscar(C.stockBot(db), args[1]);
      if (!carta) return responder(`No encontré esa carta. Mira los ID con *${prefix}mercado bot*.`);
      const pie = `${EMOJI_RAREZA[carta.rareza]} ${carta.emoji} *${carta.nombre}* (${C.NOMBRE_RAREZA[carta.rareza]})\n💰 $${C.precioVentaBot(carta.rareza)} · ID: \`${carta.id}\``;
      if (!carta.imagen) return responder(`${pie}\n_(esta carta no tiene imagen guardada)_`);
      try {
        const buffer = await descargarImagenBuffer(carta.imagen);
        return sock.sendMessage(jid, { image: buffer, caption: pie }, { quoted: msg });
      } catch (_) { return responder(`${pie}\n_(no se pudo traer la imagen ahora mismo)_`); }
    }

    if (sub === 'comprar') {
      const db = leerDB();
      const stock = C.stockBot(db);
      const carta = buscar(stock, args[1]);
      if (!args[1]) return responder(`Uso: ${prefix}mercado comprar <ID>\nMira los ID con ${prefix}mercado bot`);
      if (!carta) return responder('Esa carta ya no está disponible o el ID no existe.');
      const comprador = getUsuario(db, await llaveRemitente(sock, jid, db, msg));
      const precio = C.precioVentaBot(carta.rareza);
      if (comprador.saldo < precio) return responder(`No tienes suficientes monedas. Cuesta *$${precio}* y tienes $${comprador.saldo}.`);
      comprador.saldo -= precio;
      if (!comprador.gachaAnime) comprador.gachaAnime = {};
      comprador.gachaAnime[carta.nombre] = (comprador.gachaAnime[carta.nombre] || 0) + 1;
      if (carta.imagen) { if (!comprador.gachaAnimeFotos) comprador.gachaAnimeFotos = {}; comprador.gachaAnimeFotos[carta.nombre] = carta.imagen; }
      stock.splice(stock.indexOf(carta), 1);
      guardarDB(db);
      return responder(`✅ *¡Compra exitosa!*\n\n${EMOJI_RAREZA[carta.rareza]} ${carta.emoji} *${carta.nombre}* ya es tuya.\n💰 Pagaste: $${precio}\n💳 Tu saldo: $${comprador.saldo}`);
    }

    return responder(`🏪 *MERCADO*\n\n• ${prefix}mercado bot — cartas que el bot compró\n• ${prefix}mercado comprar <ID> — comprarle una carta al bot\n• ${prefix}mercado ver <ID> — ver su imagen\n\nEntre jugadores: ${prefix}mercadoanime`);
  }
};

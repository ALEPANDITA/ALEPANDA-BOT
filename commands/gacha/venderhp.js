const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { buscarPersonaje } = require('../../lib/gachahp');
const { asegurarMercado, generarId } = require('../../lib/mercado');

module.exports = {
  name: 'venderhp',
  category: 'gacha',
  description: 'Pone uno de tus personajes en venta en el mercado. Uso: .venderhp <nombre del personaje> <precio>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);

    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}venderhp <nombre del personaje> <precio>\nEj: ${prefix}venderhp Heredero Orgulloso 150`
      }, { quoted: msg });
    }

    const precio = parseInt(args[args.length - 1]);
    const nombreBuscado = args.slice(0, -1).join(' ');

    if (!precio || precio <= 0) {
      return sock.sendMessage(jid, { text: 'El precio tiene que ser un numero mayor a 0.' }, { quoted: msg });
    }

    const personaje = buscarPersonaje(nombreBuscado);
    if (!personaje) {
      return sock.sendMessage(jid, { text: `No existe ningun personaje magico llamado "${nombreBuscado}".` }, { quoted: msg });
    }

    const db = leerDB();
    const perfil = getUsuario(db, remitente);
    if (!perfil.gachaHP) perfil.gachaHP = {};

    if (!perfil.gachaHP[personaje.nombre] || perfil.gachaHP[personaje.nombre] < 1) {
      return sock.sendMessage(jid, { text: `No tienes a *${personaje.nombre}* en tu coleccion.` }, { quoted: msg });
    }

    perfil.gachaHP[personaje.nombre] -= 1;
    if (perfil.gachaHP[personaje.nombre] <= 0) delete perfil.gachaHP[personaje.nombre];

    const mercado = asegurarMercado(db);
    const id = generarId('v');
    mercado.ventas[id] = {
      id,
      vendedor: remitente,
      nombre: personaje.nombre,
      casa: personaje.casa,
      rareza: personaje.rareza,
      emoji: personaje.emoji,
      frase: personaje.frase,
      precio,
      timestamp: Date.now(),
      jid
    };

    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `🏷️ *Publicado en el mercado*\n\n` +
        `${personaje.emoji} *${personaje.nombre}*\n` +
        `💰 Precio: $${precio}\n` +
        `🆔 ID: \`${id}\`\n\n` +
        `Cualquiera puede comprarlo con: ${prefix}comprarhp ${id}\n` +
        `Si te arrepientes: ${prefix}cancelarventahp ${id}`
    }, { quoted: msg });
  }
};

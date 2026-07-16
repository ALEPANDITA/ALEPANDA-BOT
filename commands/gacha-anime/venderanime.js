const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { buscarArquetipo } = require('../../lib/gachaanime');
const { asegurarMercadoAnime } = require('../../lib/mercadoanime');
const { generarId } = require('../../lib/mercado');

module.exports = {
  name: 'venderanime',
  category: 'gacha-anime',
  description: 'Pone una de tus ilustraciones de anime en venta. Uso: .venderanime <nombre> <precio>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);

    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}venderanime <nombre> <precio>\nEj: ${prefix}venderanime Kitsune Ancestral 150`
      }, { quoted: msg });
    }

    const precio = parseInt(args[args.length - 1]);
    const nombreBuscado = args.slice(0, -1).join(' ');

    if (!precio || precio <= 0) {
      return sock.sendMessage(jid, { text: 'El precio tiene que ser un numero mayor a 0.' }, { quoted: msg });
    }

    const arquetipo = buscarArquetipo(nombreBuscado);
    if (!arquetipo) {
      return sock.sendMessage(jid, { text: `Ese nombre no existe. Revisa tu coleccion con ${prefix}coleccionanime.` }, { quoted: msg });
    }

    const db = leerDB();
    const perfil = getUsuario(db, remitente);
    if (!perfil.gachaAnime) perfil.gachaAnime = {};

    if (!perfil.gachaAnime[arquetipo.nombre] || perfil.gachaAnime[arquetipo.nombre] < 1) {
      return sock.sendMessage(jid, { text: `No tienes a *${arquetipo.nombre}* en tu coleccion.` }, { quoted: msg });
    }

    perfil.gachaAnime[arquetipo.nombre] -= 1;
    if (perfil.gachaAnime[arquetipo.nombre] <= 0) delete perfil.gachaAnime[arquetipo.nombre];

    const mercado = asegurarMercadoAnime(db);
    const id = generarId('va');
    mercado.ventas[id] = {
      id,
      vendedor: remitente,
      nombre: arquetipo.nombre,
      rareza: arquetipo.rareza,
      emoji: arquetipo.emoji,
      precio,
      timestamp: Date.now(),
      jid
    };

    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `🏷️ *Publicado en el mercado anime*\n\n` +
        `${arquetipo.emoji} *${arquetipo.nombre}*\n` +
        `💰 Precio: $${precio}\n` +
        `🆔 ID: \`${id}\`\n\n` +
        `Cualquiera puede comprarlo con: ${prefix}compraranime ${id}\n` +
        `Si te arrepientes: ${prefix}cancelarventaanime ${id}`
    }, { quoted: msg });
  }
};

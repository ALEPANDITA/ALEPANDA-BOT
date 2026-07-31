const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { buscarArquetipo } = require('../../lib/gachaanime');
const { asegurarMercadoAnime } = require('../../lib/mercadoanime');
const { generarId } = require('../../lib/mercado');

const MIN_MINUTOS = 2;
const MAX_MINUTOS = 180;

module.exports = {
  name: 'subastaranime',
  category: 'gacha-anime',
  description: 'Pone una de tus ilustraciones de anime en subasta. Uso: .subastaranime <nombre> <precio inicial> <minutos>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);

    if (args.length < 3) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}subastaranime <nombre> <precio inicial> <minutos>\nEj: ${prefix}subastaranime Waifu Misteriosa 200 15`
      }, { quoted: msg });
    }

    const minutos = parseInt(args[args.length - 1]);
    const precioInicial = parseInt(args[args.length - 2]);
    const nombreBuscado = args.slice(0, -2).join(' ');

    if (!precioInicial || precioInicial <= 0) {
      return sock.sendMessage(jid, { text: 'El precio inicial tiene que ser un numero mayor a 0.' }, { quoted: msg });
    }

    if (!minutos || minutos < MIN_MINUTOS || minutos > MAX_MINUTOS) {
      return sock.sendMessage(jid, { text: `La duracion tiene que ser entre ${MIN_MINUTOS} y ${MAX_MINUTOS} minutos.` }, { quoted: msg });
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
    const id = generarId('sa');
    const finalizaEn = Date.now() + minutos * 60000;

    mercado.subastas[id] = {
      id,
      vendedor: remitente,
      nombre: arquetipo.nombre,
      rareza: arquetipo.rareza,
      emoji: arquetipo.emoji,
      precioInicial,
      precioActual: precioInicial,
      mejorPostor: null,
      creado: Date.now(),
      finalizaEn,
      jid,
      estado: 'activa'
    };

    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `🔨 *¡Nueva subasta anime!*\n\n` +
        `${arquetipo.emoji} *${arquetipo.nombre}*\n` +
        `💰 Precio inicial: $${precioInicial}\n` +
        `⏳ Duracion: ${minutos} minuto(s)\n` +
        `🆔 ID: \`${id}\`\n\n` +
        `Puja con: ${prefix}pujaranime ${id} <monto>`
    }, { quoted: msg });
  }
};

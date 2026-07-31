const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { buscarPersonaje } = require('../../lib/gachahp');
const { asegurarMercado, generarId } = require('../../lib/mercado');

const MIN_MINUTOS = 2;
const MAX_MINUTOS = 180;

module.exports = {
  name: 'subastarhp',
  category: 'gacha',
  description: 'Pone uno de tus personajes en subasta. Uso: .subastarhp <nombre del personaje> <precio inicial> <minutos>',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const args = texto.slice(prefix.length).trim().split(/\s+/).slice(1);

    if (args.length < 3) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}subastarhp <nombre del personaje> <precio inicial> <minutos>\nEj: ${prefix}subastarhp El Elegido 200 15`
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
    const id = generarId('s');
    const finalizaEn = Date.now() + minutos * 60000;

    mercado.subastas[id] = {
      id,
      vendedor: remitente,
      nombre: personaje.nombre,
      casa: personaje.casa,
      rareza: personaje.rareza,
      emoji: personaje.emoji,
      frase: personaje.frase,
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
        `🔨 *¡Nueva subasta!*\n\n` +
        `${personaje.emoji} *${personaje.nombre}*\n` +
        `💰 Precio inicial: $${precioInicial}\n` +
        `⏳ Duracion: ${minutos} minuto(s)\n` +
        `🆔 ID: \`${id}\`\n\n` +
        `Puja con: ${prefix}pujarhp ${id} <monto>`
    }, { quoted: msg });
  }
};

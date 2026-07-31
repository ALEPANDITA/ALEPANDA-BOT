const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachaanime');

const TIEMPO_CLAIM_MS = 3 * 60 * 1000; // debe coincidir con rollanime.js

module.exports = {
  name: 'claimanime',
  category: 'gacha-anime',
  description: 'Reclama la ilustracion de anime que te salio con .rollanime',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    const pendiente = perfil.pendingGachaAnime;

    if (!pendiente) {
      return sock.sendMessage(jid, {
        text: '🤷 No tienes ninguna ilustracion esperando. Usa *.rollanime* primero.'
      }, { quoted: msg });
    }

    const ahora = Date.now();
    const transcurrido = ahora - pendiente.timestamp;

    if (transcurrido > TIEMPO_CLAIM_MS) {
      delete perfil.pendingGachaAnime;
      guardarDB(db);
      return sock.sendMessage(jid, {
        text: `💨 *${pendiente.nombre}* se escapo porque tardaste demasiado. Usa *.rollanime* para intentarlo de nuevo.`
      }, { quoted: msg });
    }

    if (!perfil.gachaAnime) perfil.gachaAnime = {};
    const clave = pendiente.nombre;
    perfil.gachaAnime[clave] = (perfil.gachaAnime[clave] || 0) + 1;
    const copias = perfil.gachaAnime[clave];

    delete perfil.pendingGachaAnime;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `✅ ${EMOJI_RAREZA[pendiente.rareza]} *¡Reclamaste a ${pendiente.nombre}!*\n` +
        `${copias > 1 ? `Ahora tienes ${copias} copias.` : '¡Primera vez que la consigues!'}`
    }, { quoted: msg });
  }
};

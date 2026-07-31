const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { EMOJI_RAREZA } = require('../../lib/gachahp');

const TIEMPO_CLAIM_MS = 3 * 60 * 1000; // debe coincidir con rollhp.js

module.exports = {
  name: 'claim',
  category: 'gacha',
  description: 'Reclama el personaje que te salió con .rollhp antes de que se acabe el tiempo',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const perfil = getUsuario(db, remitente);

    const pendiente = perfil.pendingGachaHP;

    if (!pendiente) {
      return sock.sendMessage(jid, {
        text: '🤷 No tienes ningún personaje esperando. Usa *.rollhp* primero.'
      }, { quoted: msg });
    }

    const ahora = Date.now();
    const transcurrido = ahora - pendiente.timestamp;

    if (transcurrido > TIEMPO_CLAIM_MS) {
      delete perfil.pendingGachaHP;
      guardarDB(db);
      return sock.sendMessage(jid, {
        text: `💨 *${pendiente.nombre}* se escapó porque tardaste demasiado en reclamarlo. Usa *.rollhp* para intentarlo de nuevo.`
      }, { quoted: msg });
    }

    if (!perfil.gachaHP) perfil.gachaHP = {};
    const clave = pendiente.nombre;
    perfil.gachaHP[clave] = (perfil.gachaHP[clave] || 0) + 1;
    const copias = perfil.gachaHP[clave];

    delete perfil.pendingGachaHP;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text:
        `✅ ${EMOJI_RAREZA[pendiente.rareza]} *¡Reclamaste a ${pendiente.nombre}!*\n` +
        `${copias > 1 ? `Ahora tienes ${copias} copias.` : '¡Primera vez que lo consigues!'}`
    }, { quoted: msg });
  }
};

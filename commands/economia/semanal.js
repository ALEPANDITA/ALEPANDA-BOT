const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const BONO = 4000;

const tiempo = (ms) => { const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); const m = Math.ceil((ms % 3600000) / 60000); return d ? `${d} día(s) y ${h} hora(s)` : h ? `${h} hora(s) y ${m} min` : `${m} min`; };

module.exports = {
  name: 'semanal',
  aliases: ['weekly'],
  category: 'economia',
  description: `Reclama tu bono semanal de $${BONO} (cada 7 días)`,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const ahora = Date.now();
    const restante = (usuario.lastSemanal || 0) + COOLDOWN - ahora;
    if (restante > 0) return sock.sendMessage(jid, { text: advertencia(`Ya reclamaste tu bono semanal. Vuelve en ${tiempo(restante)}.`, { titulo: 'ESPERA UN POCO' }) }, { quoted: msg });
    usuario.saldo += BONO;
    usuario.lastSemanal = ahora;
    guardarDB(db);
    await sock.sendMessage(jid, { text: exito(`Reclamaste tu bono semanal de *$${BONO}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'BONO SEMANAL' }) }, { quoted: msg });
  }
};

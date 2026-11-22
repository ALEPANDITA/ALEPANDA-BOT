const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

const COOLDOWN = 30 * 24 * 60 * 60 * 1000;
const BONO = 20000;

const tiempo = (ms) => { const d = Math.floor(ms / 86400000); const h = Math.floor((ms % 86400000) / 3600000); return d ? `${d} día(s) y ${h} hora(s)` : `${h} hora(s)`; };

module.exports = {
  name: 'mensual',
  aliases: ['monthly'],
  category: 'economia',
  description: `Reclama tu bono mensual de $${BONO} (cada 30 días)`,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const ahora = Date.now();
    const restante = (usuario.lastMensual || 0) + COOLDOWN - ahora;
    if (restante > 0) return sock.sendMessage(jid, { text: advertencia(`Ya reclamaste tu bono mensual. Vuelve en ${tiempo(restante)}.`, { titulo: 'ESPERA UN POCO' }) }, { quoted: msg });
    usuario.saldo += BONO;
    usuario.lastMensual = ahora;
    guardarDB(db);
    await sock.sendMessage(jid, { text: exito(`Reclamaste tu bono mensual de *$${BONO}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'BONO MENSUAL' }) }, { quoted: msg });
  }
};

const { caja, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const M = require('../../lib/misiones');

module.exports = {
  name: 'misiones',
  aliases: ['mision', 'quest', 'quests', 'retos', 'desafios'],
  category: 'economia',
  description: 'Tus 5 misiones de 24 horas según cuánto dinero juntas. Al completar 5 tus negocios dan multiplicador extra',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const u = getUsuario(db, remitente);
    const lineas = M.panel(db, u);
    guardarDB(db); // por si se acaban de crear las misiones de hoy
    return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'MISIONES', estilo: porCategoria('economia') }) }, { quoted: msg });
  }
};

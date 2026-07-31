const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  name: 'diario',
  category: 'economia',
  description: 'Reclamar tu bono diario',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastDiario + COOLDOWN - ahora;

    if (restante > 0) {
      const horas = Math.ceil(restante / 3600000);
      return sock.sendMessage(jid, {
        text: advertencia(`Ya reclamaste tu diario. Vuelve en ${horas} hora(s).`, { titulo: 'ESPERA UN POCO' })
      });
    }

    const bono = 500;
    usuario.saldo += bono;
    usuario.lastDiario = ahora;
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Reclamaste tu bono diario de *$${bono}*.\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'BONO DIARIO' })
    });
  }
};

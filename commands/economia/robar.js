const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COOLDOWN = 60 * 60 * 1000;

module.exports = {
  name: 'robar',
  category: 'economia',
  description: 'Intenta robarle dinero a alguien (mencion o responde)',
  execute: async (sock, jid, msg, { prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona o responde a alguien: ${prefix}robar` });
    }

    if (objetivo === remitente) {
      return sock.sendMessage(jid, { text: 'No puedes robarte a ti mismo.' });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);
    const victima = getUsuario(db, objetivo);

    const ahora = Date.now();
    const restante = usuario.lastRobar + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, { text: `⏳ Espera ${minutos} minuto(s) para volver a robar.` });
    }

    usuario.lastRobar = ahora;

    if (victima.saldo < 100) {
      guardarDB(db);
      return sock.sendMessage(jid, { text: 'Esa persona no tiene suficiente dinero en mano para robarle.' });
    }

    const exito = Math.random() < 0.45;

    if (exito) {
      const monto = Math.floor(victima.saldo * (Math.random() * 0.3 + 0.1));
      victima.saldo -= monto;
      usuario.saldo += monto;
      guardarDB(db);
      return sock.sendMessage(jid, {
        text: `🥷 Le robaste *$${monto}* a @${objetivo.split('@')[0]}.\nTu saldo: *$${usuario.saldo}*`,
        mentions: [objetivo]
      });
    }

    const multa = Math.floor(Math.random() * 150) + 50;
    usuario.saldo = Math.max(0, usuario.saldo - multa);
    guardarDB(db);
    await sock.sendMessage(jid, { text: `🚨 Te atraparon intentando robar y pagaste *$${multa}* de multa.\nSaldo actual: *$${usuario.saldo}*` });
  }
};

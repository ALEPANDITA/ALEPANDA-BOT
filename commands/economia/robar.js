const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { llaveRemitente, llavePersona, objetivoDe } = require('../../lib/economiaid');

const COOLDOWN = 60 * 60 * 1000;

module.exports = {
  name: 'robar',
  category: 'economia',
  description: 'Intenta robarle dinero a alguien (mencion o responde)',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const objetivo = objetivoDe(msg, texto);

    if (!objetivo) {
      return sock.sendMessage(jid, { text: `Menciona o responde a alguien: ${prefix}robar @usuario` });
    }

    const db = leerDB();
    // Misma identidad unica que el resto de la economia (lid / numero real = una sola cartera)
    const llaveYo = await llaveRemitente(sock, jid, db, msg);
    const llaveVictima = await llavePersona(sock, jid, db, objetivo);

    if (llaveYo === llaveVictima) {
      return sock.sendMessage(jid, { text: 'No puedes robarte a ti mismo.' });
    }

    const usuario = getUsuario(db, llaveYo);
    const victima = getUsuario(db, llaveVictima);

    const ahora = Date.now();
    const restante = usuario.lastRobar + COOLDOWN - ahora;

    if (restante > 0) {
      guardarDB(db);
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
        text: `🥷 Le robaste *$${monto}* a @${objetivo.split('@')[0].split(':')[0]}.\nTu saldo: *$${usuario.saldo}*`,
        mentions: [objetivo]
      });
    }

    const multa = Math.floor(Math.random() * 150) + 50;
    usuario.saldo = Math.max(0, usuario.saldo - multa);
    guardarDB(db);
    await sock.sendMessage(jid, { text: `🚨 Te atraparon intentando robar y pagaste *$${multa}* de multa.\nSaldo actual: *$${usuario.saldo}*` });
  }
};

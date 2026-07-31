const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

const COOLDOWN = 45 * 60 * 1000;
const crimenes = [
  'robaste una tienda', 'hackeaste un cajero', 'vendiste productos falsos',
  'estafaste a un turista', 'robaste un banco pequeño'
];

module.exports = {
  name: 'crimen',
  category: 'economia',
  description: 'Comete un crimen arriesgado por dinero (cada 45 min)',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    const ahora = Date.now();
    const restante = usuario.lastCrimen + COOLDOWN - ahora;

    if (restante > 0) {
      const minutos = Math.ceil(restante / 60000);
      return sock.sendMessage(jid, { text: `⏳ Espera ${minutos} minuto(s) para volver a intentar un crimen.` });
    }

    usuario.lastCrimen = ahora;
    const exito = Math.random() < 0.55;
    const crimenTexto = crimenes[Math.floor(Math.random() * crimenes.length)];

    if (exito) {
      const ganancia = Math.floor(Math.random() * 400) + 100;
      usuario.saldo += ganancia;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `🕵️ ${crimenTexto} y saliste bien librado.\nGanaste *$${ganancia}*.\nSaldo actual: *$${usuario.saldo}*` });
    }

    const multa = Math.floor(Math.random() * 200) + 50;
    usuario.saldo = Math.max(0, usuario.saldo - multa);
    guardarDB(db);
    await sock.sendMessage(jid, { text: `🚓 Intentaste ${crimenTexto.replace('robaste', 'robar')} pero te atraparon.\nPagaste una multa de *$${multa}*.\nSaldo actual: *$${usuario.saldo}*` });
  }
};

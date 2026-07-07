const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

module.exports = {
  name: 'apostar',
  category: 'casino',
  description: 'Apostar cara o cruz (ej: .apostar 100 cara)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const partes = texto.trim().split(/\s+/);
    const apuesta = parseInt(partes[1]);
    const eleccion = (partes[2] || '').toLowerCase();

    if (!apuesta || apuesta <= 0 || !['cara', 'cruz'].includes(eleccion)) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}apostar <monto> <cara/cruz>` });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, { text: `No tienes suficiente saldo. Tu saldo: $${usuario.saldo}` });
    }

    const resultado = Math.random() < 0.5 ? 'cara' : 'cruz';
    const gano = resultado === eleccion;
    const ganancia = gano ? apuesta : -apuesta;

    usuario.saldo += ganancia;
    guardarDB(db);

    const texto2 = gano
      ? `🪙 Salio *${resultado}*. ¡Ganaste *$${apuesta}*!`
      : `🪙 Salio *${resultado}*. Perdiste *$${apuesta}*.`;

    await sock.sendMessage(jid, { text: `${texto2}\nSaldo actual: *$${usuario.saldo}*` });
  }
};

const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { exito, error: cajaError, advertencia } = require('../../lib/estilo');

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
      return sock.sendMessage(jid, {
        text: advertencia(`Uso: ${prefix}apostar <monto> <cara/cruz>`, { titulo: 'CARA O CRUZ', estilo: 'gamer' })
      });
    }

    const db = leerDB();
    const usuario = getUsuario(db, remitente);

    if (usuario.saldo < apuesta) {
      return sock.sendMessage(jid, {
        text: cajaError(`No tienes suficiente saldo.\nTu saldo: *$${usuario.saldo}*`)
      });
    }

    const resultado = Math.random() < 0.5 ? 'cara' : 'cruz';
    const gano = resultado === eleccion;
    const ganancia = gano ? apuesta : -apuesta;

    usuario.saldo += ganancia;
    guardarDB(db);

    const linea = gano
      ? `🪙 Salio *${resultado}*. ¡Ganaste *$${apuesta}*!`
      : `🪙 Salio *${resultado}*. Perdiste *$${apuesta}*.`;

    const texto2 = gano
      ? exito(`${linea}\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'CARA O CRUZ', estilo: 'gamer' })
      : cajaError(`${linea}\nSaldo actual: *$${usuario.saldo}*`, { titulo: 'CARA O CRUZ', estilo: 'gamer' });

    await sock.sendMessage(jid, { text: texto2 });
  }
};

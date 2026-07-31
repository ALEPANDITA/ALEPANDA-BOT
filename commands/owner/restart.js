const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, info } = require('../../lib/estilo');

// Mensajes de reinicio con distinta probabilidad (mismo sistema de pesos del gacha):
// el mas comun sale casi la mitad de las veces, el mas raro casi no se ve.
const MENSAJES_RESTART = [
  { texto: 'Afilando garras antes de volver... dame un momento y regreso mas fuerte 🐼', peso: 45 },
  { texto: 'Recargando bambu y energia... dame unos segunditos y regreso como nuevo ⚡', peso: 30 },
  { texto: 'Me escondi un rato en el bosque de bambu a descansar tantito, ya casi vuelvo 🎋💤', peso: 17 },
  { texto: 'Reiniciando en 3, 2, 1... ni el panda mas rudo se libra de una recarga 🐼✨', peso: 8 }
];

function elegirMensaje() {
  const total = MENSAJES_RESTART.reduce((suma, m) => suma + m.peso, 0);
  let random = Math.random() * total;
  for (const m of MENSAJES_RESTART) {
    if (random < m.peso) return m.texto;
    random -= m.peso;
  }
  return MENSAJES_RESTART[0].texto;
}

module.exports = {
  name: 'restart',
  category: 'owner',
  description: 'Reinicia el bot (solo owner)',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, {
      text: info(elegirMensaje(), { titulo: 'RESTART', estilo: 'neon' })
    });

    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
};

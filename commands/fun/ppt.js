const opciones = ['piedra', 'papel', 'tijera'];

function ganador(user, bot) {
  if (user === bot) return 'empate';
  if (
    (user === 'piedra' && bot === 'tijera') ||
    (user === 'papel' && bot === 'piedra') ||
    (user === 'tijera' && bot === 'papel')
  ) return 'user';
  return 'bot';
}

module.exports = {
  name: 'ppt',
  category: 'fun',
  description: 'Juega piedra, papel o tijera contra el bot',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const partes = (texto || '').trim().split(/\s+/);
    const eleccion = (partes[1] || '').toLowerCase();

    if (!opciones.includes(eleccion)) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}ppt <piedra|papel|tijera>`
      });
    }

    const eleccionBot = opciones[Math.floor(Math.random() * opciones.length)];
    const resultado = ganador(eleccion, eleccionBot);

    const textoResultado = resultado === 'empate'
      ? '🤝 Empate.'
      : resultado === 'user'
        ? '🎉 Ganaste!'
        : '🤖 Gano el bot.';

    await sock.sendMessage(jid, {
      text: `Elegiste: *${eleccion}*\nBot eligio: *${eleccionBot}*\n\n${textoResultado}`
    });
  }
};

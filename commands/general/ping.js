const { caja } = require('../../lib/estilo');

module.exports = {
  name: 'ping',
  category: 'general',
  description: 'Muestra la latencia del bot',
  execute: async (sock, jid, msg) => {
    const inicio = Date.now();
    const enviado = await sock.sendMessage(jid, { text: '🏓 Calculando...' });
    const latencia = Date.now() - inicio;

    const texto = caja([`🏓 Pong! Latencia: *${latencia}ms*`], { titulo: 'ESTADO DEL BOT', estilo: 'minimal' });

    await sock.sendMessage(jid, { text: texto, edit: enviado.key }).catch(async () => {
      await sock.sendMessage(jid, { text: texto });
    });
  }
};

const { enviarReaccionDelirius } = require('../../lib/animereact');

module.exports = {
  name: 'matar',
  category: 'anime',
  description: 'lo mata con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccionDelirius(sock, jid, msg, {
    endpoint: 'kill',
    emoji: '🔪',
    conObjetivo: (yo, el) => `@${yo} mató a @${el}`,
    sinObjetivo: (yo) => `@${yo} está en modo asesino`
  })
};

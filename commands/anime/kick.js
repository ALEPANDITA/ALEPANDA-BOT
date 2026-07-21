const { enviarReaccionDelirius } = require('../../lib/animereact');

module.exports = {
  name: 'kick',
  category: 'anime',
  description: 'le da una patada con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccionDelirius(sock, jid, msg, {
    endpoint: 'kick',
    emoji: '🦵',
    conObjetivo: (yo, el) => `@${yo} le dio una patada a @${el}`,
    sinObjetivo: (yo) => `@${yo} esta pateando el aire`
  })
};

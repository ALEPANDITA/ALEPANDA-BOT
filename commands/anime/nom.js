const { enviarReaccionDelirius } = require('../../lib/animereact');

module.exports = {
  name: 'nom',
  category: 'anime',
  description: 'se come algo/a alguien con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccionDelirius(sock, jid, msg, {
    endpoint: 'nom',
    emoji: '😋',
    conObjetivo: (yo, el) => `@${yo} se esta comiendo a @${el}`,
    sinObjetivo: (yo) => `@${yo} tiene hambre`
  })
};

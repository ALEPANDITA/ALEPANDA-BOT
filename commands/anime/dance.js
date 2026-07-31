const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'dance',
  category: 'anime',
  description: 'esta bailando con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'dance',
    emoji: '💃',
    conObjetivo: (yo, el) => `@${yo} esta bailando a @${el}`,
    sinObjetivo: (yo) => `@${yo} esta bailando`
  })
};

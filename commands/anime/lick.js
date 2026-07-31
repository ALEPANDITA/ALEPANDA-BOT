const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'lick',
  category: 'anime',
  description: 'le lame con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'lick',
    emoji: '😛',
    conObjetivo: (yo, el) => `@${yo} le lame a @${el}`,
    sinObjetivo: (yo) => `@${yo} le lame`
  })
};

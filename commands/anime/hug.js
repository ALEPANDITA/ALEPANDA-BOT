const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'hug',
  category: 'anime',
  description: 'le da un abrazo con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'hug',
    emoji: '🤗',
    conObjetivo: (yo, el) => `@${yo} le da un abrazo a @${el}`,
    sinObjetivo: (yo) => `@${yo} le da un abrazo`
  })
};

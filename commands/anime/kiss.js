const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'kiss',
  category: 'anime',
  description: 'le da un beso con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'kiss',
    emoji: '😘',
    conObjetivo: (yo, el) => `@${yo} le da un beso a @${el}`,
    sinObjetivo: (yo) => `@${yo} le da un beso`
  })
};

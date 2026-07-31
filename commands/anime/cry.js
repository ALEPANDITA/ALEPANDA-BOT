const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'cry',
  category: 'anime',
  description: 'esta llorando con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'cry',
    emoji: '😢',
    conObjetivo: (yo, el) => `@${yo} esta llorando a @${el}`,
    sinObjetivo: (yo) => `@${yo} esta llorando`
  })
};

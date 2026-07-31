const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'happy',
  category: 'anime',
  description: 'esta feliz con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'happy',
    emoji: '😊',
    conObjetivo: (yo, el) => `@${yo} esta feliz a @${el}`,
    sinObjetivo: (yo) => `@${yo} esta feliz`
  })
};

const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'bite',
  category: 'anime',
  description: 'le muerde con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'bite',
    emoji: '😬',
    conObjetivo: (yo, el) => `@${yo} le muerde a @${el}`,
    sinObjetivo: (yo) => `@${yo} le muerde`
  })
};

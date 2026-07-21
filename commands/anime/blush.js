const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'blush',
  category: 'anime',
  description: 'se sonrojo con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'blush',
    emoji: '😳',
    conObjetivo: (yo, el) => `@${yo} se sonrojo a @${el}`,
    sinObjetivo: (yo) => `@${yo} se sonrojo`
  })
};

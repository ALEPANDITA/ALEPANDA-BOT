const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'pegar',
  category: 'anime',
  description: 'le pega con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'punch',
    emoji: '👊',
    conObjetivo: (yo, el) => `@${yo} le pegó a @${el}`,
    sinObjetivo: (yo) => `@${yo} está repartiendo golpes`
  })
};

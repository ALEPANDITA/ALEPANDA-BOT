const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'slap',
  category: 'anime',
  description: 'le da una cachetada con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'slap',
    emoji: '👋',
    conObjetivo: (yo, el) => `@${yo} le da una cachetada a @${el}`,
    sinObjetivo: (yo) => `@${yo} le da una cachetada`
  })
};

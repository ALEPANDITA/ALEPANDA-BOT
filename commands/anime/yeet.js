const { enviarReaccionDelirius } = require('../../lib/animereact');

module.exports = {
  name: 'yeet',
  category: 'anime',
  description: 'avienta lejos a alguien con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccionDelirius(sock, jid, msg, {
    endpoint: 'yeet',
    emoji: '🚀',
    conObjetivo: (yo, el) => `@${yo} avento a @${el} bien lejos`,
    sinObjetivo: (yo) => `@${yo} esta aventando cosas por ahi`
  })
};

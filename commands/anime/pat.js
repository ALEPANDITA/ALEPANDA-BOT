const { enviarReaccion } = require('../../lib/animereact');

module.exports = {
  name: 'pat',
  category: 'anime',
  description: 'le da palmaditas con un gif de anime (menciona o responde a la persona)',
  execute: (sock, jid, msg) => enviarReaccion(sock, jid, msg, {
    tipo: 'pat',
    emoji: '🖐️',
    conObjetivo: (yo, el) => `@${yo} le da palmaditas a @${el}`,
    sinObjetivo: (yo) => `@${yo} le da palmaditas`
  })
};

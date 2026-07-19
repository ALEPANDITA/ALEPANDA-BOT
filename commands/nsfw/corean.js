const { enviarNsfwDirecto } = require('../../lib/nsfwDirecto');

module.exports = {
  name: 'corean',
  aliases: ['korean'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se topo con una escena corean demasiado provocativa. 🔥',
      '{autor} pidio contenido corean y recibio puro veneno visual. 😈',
      '{autor} acaba de abrir una fantasia corean que subio la temperatura del chat. 🖤',
      '{autor} encontro una joyita corean demasiado atrevida para ignorarla. 🔞',
      '{autor} se dejo tentar por un clip corean que viene cargado de pecado. 💋',
      '{autor} desenterro una escena corean que no tiene nada de inocente. 🥵',
      '{autor} invoco material corean y vaya que valio la pena. 😏',
      '{autor} se metio en modo travieso con este contenido corean. 💦',
      '{autor} acaba de soltar un NSFW corean que prende hasta la pantalla. 🌙',
      '{autor} saco un clip corean tan hot que mejor ni preguntar de donde salio. 🔥'
    ];

    await enviarNsfwDirecto(sock, jid, msg, 'corean', frases);
  }
};

const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'cum',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} termino explotando sobre {objetivo} en un final tan intenso como indecente. 💦',
      '{autor} no pudo contenerse mas y dejo a {objetivo} empapado de puro deseo. 😵‍💫',
      '{objetivo} quedo marcado por el desenlace ardiente que {autor} venia aguantando. 🔥',
      '{autor} alcanzo el limite con {objetivo} y solto toda la tension de golpe. 🖤',
      '{autor} se vino sobre {objetivo} con una intensidad que hizo arder el momento. 😈',
      '{objetivo} apenas pudo procesar lo que {autor} acababa de desatar sobre su cuerpo. 💥',
      '{autor} cerro la escena con {objetivo} de la forma mas humeda y atrevida posible. 💋',
      '{autor} termino derramando todo sobre {objetivo} mientras el ambiente se volvia caos. 🥵',
      '{objetivo} recibio el final mas descarado que {autor} podia darle. 🔞',
      '{autor} no dejo ni una pizca de duda de lo mucho que {objetivo} lo habia provocado. 😏'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'cum', frases);
  }
};

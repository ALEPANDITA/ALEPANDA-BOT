const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'cum',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se corrió encima de {objetivo} como un caballo, bañándolo en lefa. 💦',
      '{autor} no aguantó más y llenó a {objetivo} de su semen caliente. 😵‍💫',
      '{objetivo} quedó marcado por la corrida explosiva de {autor}. 🔥',
      '{autor} eyaculó sobre {objetivo} con una fuerza que lo hizo temblar. 🖤',
      '{autor} se vino en la cara de {objetivo} sin piedad ni aviso. 😈',
      '{objetivo} apenas pudo reaccionar cuando {autor} lo bañó entero. 💥',
      '{autor} cerró la escena regando a {objetivo} con toda su leche. 💋',
      '{autor} terminó derramando su esencia sobre {objetivo} hasta el último gota. 🥵',
      '{objetivo} recibió la corrida más salvaje que {autor} podía darle. 🔞',
      '{autor} dejó a {objetivo} hecho un moco de tanto semen que le echó. 😏'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'cum', frases);
  }
};

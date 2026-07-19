const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'nekonsfw',
  aliases: ['nsfwneko'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} empujó a {objetivo} contra la neko y la obligó a mamarle la verga. 🐾',
      '{autor} ordenó a la neko montarse en {objetivo} y follárselo hasta romperlo. 😈',
      '{objetivo} gritó cuando la neko clavó sus garras en su espalda mientras lo montaba. 💗',
      '{autor} sostuvo a {objetivo} mientras la neko se lo tragaba entero, sin piedad. 🔥',
      '{autor} vio cómo la neko lamía el coño de {objetivo} hasta hacerla correrse como una perra. 🖤',
      '{objetivo} se corrió dentro de la neko mientras {autor} los observaba, excitado. 😏',
      '{autor} folló a la neko por detrás mientras esta lamió los pies de {objetivo}. 🐱',
      '{autor} ató a {objetivo} y obligó a la neko a sentarse en su cara hasta ahogarlo. 💋',
      '{objetivo} terminó con la cara de la neko empapada después de que {autor} la hiciera su puto. 🥵',
      '{autor} filmó mientras la neko orinaba sobre {objetivo} marcándolo como su propiedad. 🔞'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'nekonsfw', frases);
  }
};

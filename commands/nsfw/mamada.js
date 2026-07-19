const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'blowjob',
  aliases: ['mamada'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se arrodilló y se tragó la verga de {objetivo} hasta las bolas. 😮‍💨',
      '{autor} metió toda la polla de {objetivo} en su garganta hasta ahogarse. 😈',
      '{autor} succionó a {objetivo} con tanta hambre que lo dejó seco en segundos. 🔥',
      '{objetivo} agarró de la cabeza a {autor} y la folló en la boca sin piedad. 💋',
      '{autor} lamió el culo de {objetivo} antes de devorarle la verga entera. 🖤',
      '{objetivo} se vino en la garganta de {autor} obligándolo/a a tragarlo todo. 🥵',
      '{autor} mamó a {objetivo} como una experta, jugando con sus bolas. 😏',
      '{objetivo} usó la boca de {autor} como un coño y la llenó de semen. 💦',
      '{autor} terminó con la cara de {objetivo} empapada después de tanta succión. 🔞',
      '{autor} pidió a gritos que {objetivo} se corriera en su boca cara de puto/a. 😵'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'blowjob', frases);
  }
};

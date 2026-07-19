const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'pussylick',
  aliases: ['pl'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se hundió entre las piernas de {objetivo} y se comió su coño hasta el último jugo. 👅',
      '{autor} lamió el coño de {objetivo} como un perro sediento, sin parar ni un segundo. 🔥',
      '{objetivo} se corrió en la cara de {autor} mientras le metía la lengua hasta el fondo. 😈',
      '{autor} chupó el clítoris de {objetivo} con tanta fuerza que la hizo gritar como una loca. 🖤',
      '{autor} devoró el coño de {objetivo} hasta dejarlo rojo y hinchado de tanto lamer. 💦',
      '{objetivo} agarró de los pelos a {autor} y la ahogó contra su coño hasta casi ahogarla. 😵‍💫',
      '{autor} metió dos dedos en el coño de {objetivo} mientras se lamía toda su leche. 💋',
      '{autor} despertó a {objetivo} lamiéndole el culo y el coño hasta hacerla correrse en la cama. 😏',
      '{objetivo} terminó temblando cuando {autor} le mordió el clítoris y la hizo correrse a gritos. 🔞',
      '{autor} se trago toda la corrida de {objetivo} y luego la folló hasta dejarla sin sentido. 🥵'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'pussylick', frases);
  }
};

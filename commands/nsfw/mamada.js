const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'blowjob',
  aliases: ['mamada'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} atrapo a {objetivo} en un momento demasiado intimo y lo dejo sin aliento. 😮‍💨',
      '{autor} se arrodillo frente a {objetivo} con una mirada que ya lo decia todo. 😈',
      '{autor} empezo a provocar a {objetivo} de una forma tan descarada que el ambiente se derritio. 🔥',
      '{objetivo} apenas pudo reaccionar cuando {autor} tomo la iniciativa sin ninguna pena. 💋',
      '{autor} acorralo a {objetivo} y convirtio el instante en puro deseo. 🖤',
      '{autor} dejo a {objetivo} completamente a merced de una tentacion imposible de ignorar. 🥵',
      '{autor} sabia exactamente como volver loco a {objetivo}, y lo demostro sin miedo. 😏',
      '{objetivo} termino temblando cuando {autor} se puso demasiado jugueton. 💦',
      '{autor} se entrego al momento con {objetivo} y encendio todo el chat. 🔞',
      '{autor} llevo a {objetivo} a un punto donde ya no habia forma de mantener la calma. 😵'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'blowjob', frases);
  }
};

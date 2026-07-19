const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'anal',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} arrincono a {objetivo} contra la pared y la noche tomo un rumbo demasiado intenso. 🥵',
      '{autor} no le dio escapatoria a {objetivo} y termino desatando una escena bastante atrevida. 🔥',
      '{autor} jalo a {objetivo} con firmeza y lo envolvio en un momento subido de tono. 😈',
      '{autor} tenia otras intenciones con {objetivo}, y vaya que las dejo claritas. 💋',
      '{objetivo} quedo a merced de {autor}, que venia con ganas de portarse muy mal. 😏',
      '{autor} sorprendio a {objetivo} con una embestida tan intensa que el chat entero sintio la tension. 💥',
      '{autor} se adueño del momento con {objetivo} y encendio todo alrededor. 🖤',
      '{autor} llevo a {objetivo} al limite con una jugada descarada y sin vergüenza. 🥀',
      '{autor} tomo el control de {objetivo} y convirtio el instante en puro fuego. 🔞',
      '{autor} termino provocando a {objetivo} de una forma tan salvaje que ya no hubo vuelta atras. 😵‍💫'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'anal', frases);
  }
};

const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'anal',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} follando a {objetivo} sin compasión, rompiéndolo todo. 💦',
      '{autor} cogiendo a {objetivo} como una perra en celo. 🔥',
      '{autor} metiéndosela a {objetivo} hasta el fondo, sin tregua. 😈',
      '{autor} violando a {objetivo} con la mirada antes de con el cuerpo. 🖤',
      '{objetivo} siendo usada como puto por {autor}, sangrando de placer. 🥵',
      '{autor} embistiendo a {objetivo} como animal, hasta dejarlo sin aliento. 💥',
      '{autor} jodiendo a {objetivo} contra la pared, hasta quebrarla. 🔞',
      '{autor} penetrando a {objetivo} salvajemente, sin lubricación. 😵‍💫',
      '{autor} eyaculando dentro de {objetivo} marcando su territorio. 🥀',
      '{autor} destruyendo a {objetivo} a pollazos, hasta dejarlo inservible. 💋'
  ];

    await enviarReactionDelirius(sock, jid, msg, 'anal', frases);
  }
};

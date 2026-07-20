const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'fuck',
  aliases: ['coger', 'follar'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} folló a {objetivo} como un animal, sin piedad. 🔥',
      '{autor} jodió a {objetivo} hasta dejarlo hecho mierda. 😈',
      '{objetivo} quedó destruido/a cuando {autor} lo/la rompió a pollazos. 🖤',
      '{autor} penetró a {objetivo} con tanta fuerza que gritó. 🥵',
      '{autor} se corrió dentro de {objetivo} marcando su territorio. 💥',
      '{objetivo} no pudo escapar de la verga de {autor}. 😏',
      '{autor} usó a {objetivo} como su puto/a personal. 🔞',
      '{autor} dejó a {objetivo} manco/a de tanto follar. 💋',
      '{autor} violó a {objetivo} con la mirada antes de con la verga. 😮‍💨',
      '{objetivo} terminó sangrando después de la brutalidad de {autor}. 💣'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'fuck', frases);
  }
};

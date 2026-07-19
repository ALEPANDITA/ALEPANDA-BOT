const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'yuri',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} envolvio a {objetivo} en una escena yuri tan sensual que todo se volvio fuego. 💞',
      '{autor} se acerco a {objetivo} con una dulzura peligrosa que termino en pura tentacion. 🔥',
      '{objetivo} se dejo llevar por las caricias suaves y perversas que {autor} tenia preparadas. 😈',
      '{autor} y {objetivo} quedaron atrapadas en un momento yuri lleno de deseo y miradas intensas. 🖤',
      '{autor} beso a {objetivo} con una ternura tan caliente que nadie pudo ignorarlo. 💋',
      '{objetivo} sintio como {autor} la llevaba poco a poco a un juego cada vez mas atrevido. 😏',
      '{autor} desperto en {objetivo} una fantasia yuri demasiado hermosa para ser inocente. 🥵',
      '{autor} hizo que {objetivo} se derritiera entre roces, suspiros y puro veneno dulce. 🔞',
      '{objetivo} cayo rendida ante el encanto descarado con el que {autor} la sedujo. 💗',
      '{autor} convirtio el momento con {objetivo} en una fantasia yuri elegante, suave y peligrosamente intensa. 🌙'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'yuri', frases);
  }
};

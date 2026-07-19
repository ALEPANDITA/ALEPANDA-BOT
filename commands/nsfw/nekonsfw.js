const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'nekonsfw',
  aliases: ['nsfwneko'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} acerco a {objetivo} a una neko traviesa que venia cargada de malas intenciones. 🐾',
      '{autor} puso a {objetivo} frente a una escena neko tan subida de tono que nadie quedo sano. 😈',
      '{objetivo} cayo rendido ante el juego atrevido que {autor} le preparo con esa neko. 💗',
      '{autor} solto a la neko sobre {objetivo} y el caos sexy comenzo al instante. 🔥',
      '{autor} envolvio a {objetivo} en caricias felinas que terminaron siendo demasiado provocadoras. 🖤',
      '{objetivo} no esperaba que {autor} trajera una neko con tanta picardia encima. 😏',
      '{autor} desato un momento salvaje con {objetivo} y una neko lista para pecar. 🐱',
      '{autor} hizo que {objetivo} se perdiera entre garras suaves y tentaciones peligrosas. 💋',
      '{objetivo} termino completamente hechizado por la neko que {autor} invoco para el. 🥵',
      '{autor} lanzo sobre {objetivo} una fantasia neko que cruzo todas las lineas. 🔞'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'nekonsfw', frases);
  }
};

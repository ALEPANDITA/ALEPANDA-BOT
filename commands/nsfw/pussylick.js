const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'pussylick',
  aliases: ['pl'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se arrodillo ante {objetivo} y empezo a saborearlo con una entrega descarada. 👅',
      '{autor} volvio loca a {objetivo} con una lengua traviesa que no penso detenerse. 🔥',
      '{objetivo} se derritio cuando {autor} decidio provocarla justo donde mas temblaba. 😈',
      '{autor} devoro a {objetivo} con paciencia sucia y una hambre imposible de esconder. 🖤',
      '{autor} hizo gemir a {objetivo} con una devocion tan humeda como pecaminosa. 💦',
      '{objetivo} apenas podia mantenerse firme mientras {autor} la llevaba directo al borde. 😵‍💫',
      '{autor} se perdio entre las piernas de {objetivo} como si no existiera nada mas. 💋',
      '{autor} desperto a {objetivo} a punta de lamidas lentas y muy malportadas. 😏',
      '{objetivo} termino rendida ante la lengua insistente y peligrosa de {autor}. 🔞',
      '{autor} tomo el control del placer de {objetivo} y lo llevo hasta el exceso. 🥵'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'pussylick', frases);
  }
};

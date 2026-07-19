const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'fuck',
  aliases: ['coger', 'follar'],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} tomo a {objetivo} con tanta hambre que el cuarto entero parecio temblar. 🔥',
      '{autor} arrastro a {objetivo} a un encuentro salvaje donde nadie penso en frenar. 😈',
      '{objetivo} quedo completamente dominado por la intensidad con la que {autor} lo devoro. 🖤',
      '{autor} y {objetivo} se perdieron en una escena tan brutal que sobraron las palabras. 🥵',
      '{autor} se lanzo sobre {objetivo} con deseos acumulados y cero intenciones de detenerse. 💥',
      '{objetivo} no tuvo escapatoria cuando {autor} decidio tomar el control del juego. 😏',
      '{autor} convirtio a {objetivo} en el centro de una noche llena de puro exceso. 🔞',
      '{autor} hizo suyo a {objetivo} con una energia tan feroz que encendio todo alrededor. 💋',
      '{autor} dejo claro con {objetivo} que esa noche no iba a ser para nada tranquila. 😮‍💨',
      '{objetivo} termino atrapado en el ritmo salvaje que {autor} impuso sin piedad. 💣'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'fuck', frases);
  }
};

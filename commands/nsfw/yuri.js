const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'yuri',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se comió el coño de {objetivo} hasta dejarla temblando y pidiendo más. 💞',
      '{autor} metió los dedos a {objetivo} mientras le chupaba los pezones como una perra en celo. 🔥',
      '{objetivo} se corrió en la cara de {autor} mientras le jalaba del pelo con fuerza. 😈',
      '{autor} y {objetivo} se frotaron sus coños hasta correrse juntas en un grito de placer. 🖤',
      '{autor} besó a {objetivo} probando su propia corrida en un beso sucio y lleno de lujuria. 💋',
      '{objetivo} sintió cómo {autor} le metía toda la mano en el coño hasta el puño. 😏',
      '{autor} despertó en {objetivo} una fantasía lésbica tan sucia que terminó lamiéndole el culo. 🥵',
      '{autor} hizo que {objetivo} se corriera tres veces seguidas con su lengua experta en clítoris. 🔞',
      '{objetivo} cayó rendida cuando {autor} la ató y la violó con un dildo gigante sin piedad. 💗',
      '{autor} convirtió a {objetivo} en su esclava sexual, obligándola a lamerle el coño todo el día. 🌙'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'yuri', frases);
  }
};

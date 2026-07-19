const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'solo',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} se monto su propio show caliente mientras {objetivo} no podia apartar la mirada. 😈',
      '{autor} empezo a complacerse a solas solo para torturar la mente de {objetivo}. 🔥',
      '{objetivo} quedo hipnotizado viendo a {autor} perderse en su propio placer. 🖤',
      '{autor} se entrego a una fantasia privada delante de {objetivo} y subio la temperatura del chat. 🥵',
      '{autor} se toco lentamente mientras {objetivo} soportaba cada segundo de provocacion. 💋',
      '{autor} encendio a {objetivo} con un espectaculo en solitario demasiado explicito. 🔞',
      '{objetivo} termino ardiendo por dentro al ver a {autor} jugar consigo mismo sin vergüenza. 😏',
      '{autor} convirtio su placer en un show exclusivo para volver loco a {objetivo}. 💦',
      '{autor} se dejo llevar a solas y arrastro a {objetivo} a la tentacion con solo mirar. 😵',
      '{objetivo} fue testigo de un momento tan intimo de {autor} que ya no pudo pensar con claridad. 🖤'
    ];

    await enviarReactionDelirius(sock, jid, msg, 'solo', frases);
  }
};

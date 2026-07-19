const { enviarNsfwDirecto } = require('../../lib/nsfwDirecto');

module.exports = {
  name: 'tiktok',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    const frases = [
      '{autor} pidio un tiktok prohibido y el bot no decepciono. 😈',
      '{autor} se encontro un tiktok demasiado atrevido para ser casualidad. 🔥',
      '{autor} abrio un clip tiktok que trae cero vergüenza y mucha tentacion. 🖤',
      '{autor} se lanzo por un tiktok NSFW y termino prendiendo el grupo. 🔞',
      '{autor} saco un tiktok subido de tono que viene peligrosamente bueno. 💋',
      '{autor} acaba de invocar un tiktok que no deberia ser tan sexy. 😏',
      '{autor} trajo un tiktok caliente que parece hecho para pecar. 🥵',
      '{autor} no se conformo con poco y saco un tiktok bastante sucio. 💦',
      '{autor} encontro un tiktok tan atrevido que hasta el chat se sonrojo. 🌚',
      '{autor} destapo un tiktok prohibido que viene fuertecito. 🔥'
    ];

    await enviarNsfwDirecto(sock, jid, msg, 'tiktok', frases);
  }
};

const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'anal',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    await enviarReactionDelirius(
      sock,
      jid,
      msg,
      'anal',
      (tag) => `🥵 ${tag} fue atrapado en una escena *anal*`
    );
  }
};

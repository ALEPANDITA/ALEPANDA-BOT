const { enviarReactionDelirius } = require('../../lib/reactions');

module.exports = {
  name: 'anal',
  aliases: [],
  category: 'nsfw',
  groupOnly: true,

  async execute(sock, jid, msg) {
    await enviarReactionDelirius(sock, jid, msg, 'anal', '🥵 Reaccion anal para @usuario');
  }
};

const { elegirAleatorio } = require('./reactions');

async function enviarNsfwDirecto(sock, jid, msg, endpoint, tipo, frases = []) {
  const autor = msg.key.participant || msg.key.remoteJid;
  const tagAutor = `@${autor.split('@')[0]}`;
  const mediaUrl = `https://api.delirius.store/nsfw/${endpoint}`;
  const caption = (elegirAleatorio(frases) || `🔞 NSFW para ${tagAutor}`)
    .replaceAll('{autor}', tagAutor);

  if (tipo === 'video') {
    return sock.sendMessage(
      jid,
      {
        video: { url: mediaUrl },
        caption,
        mentions: [autor],
        gifPlayback: true
      },
      { quoted: msg }
    );
  }

  return sock.sendMessage(
    jid,
    {
      image: { url: mediaUrl },
      caption,
      mentions: [autor]
    },
    { quoted: msg }
  );
}

module.exports = { enviarNsfwDirecto };

const { fetchJson, elegirAleatorio } = require('./reactions');

async function enviarNsfwDirecto(sock, jid, msg, endpoint, frases = []) {
  const json = await fetchJson(`https://api.delirius.store/nsfw/${endpoint}`);

  if (!json?.status || !json?.data?.url) {
    throw new Error('La API no devolvio una URL valida');
  }

  const mediaUrl = json.data.url;
  const autor = msg.key.participant || msg.key.remoteJid;
  const tagAutor = `@${autor.split('@')[0]}`;
  const caption = (elegirAleatorio(frases) || `🔞 NSFW para ${tagAutor}`)
    .replaceAll('{autor}', tagAutor);

  const lower = mediaUrl.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
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

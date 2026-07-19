const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function obtenerObjetivo(msg) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
  const mencionado = contextInfo.mentionedJid?.[0] || null;
  return mencionado || msg.key.participant || msg.key.remoteJid;
}

async function enviarReactionDelirius(sock, jid, msg, endpoint, texto = null) {
  const api = `https://api.delirius.store/reactions/${endpoint}`;
  const json = await fetchJson(api);

  if (!json?.status || !json?.data?.url) {
    throw new Error('La API no devolvio una URL valida');
  }

  const mediaUrl = json.data.url;
  const target = obtenerObjetivo(msg);
  const caption = texto || `✨ Reaccion: *${endpoint}* para @${target.split('@')[0]}`;

  const lower = mediaUrl.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return sock.sendMessage(
      jid,
      {
        video: { url: mediaUrl },
        caption,
        mentions: [target],
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
      mentions: [target]
    },
    { quoted: msg }
  );
}

module.exports = {
  fetchJson,
  obtenerObjetivo,
  enviarReactionDelirius
};

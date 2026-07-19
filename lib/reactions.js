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

async function resolverJidReal(sock, jid, userId) {
  if (!userId) return null;
  if (userId.endsWith('@s.whatsapp.net')) return userId;

  if (userId.endsWith('@lid')) {
    try {
      const metadata = await sock.groupMetadata(jid);
      const encontrado = metadata.participants.find(p => p.id === userId || p.jid === userId);
      if (encontrado?.id?.endsWith('@s.whatsapp.net')) return encontrado.id;
      if (encontrado?.jid?.endsWith('@s.whatsapp.net')) return encontrado.jid;
    } catch {}
  }

  return userId;
}

async function obtenerObjetivo(sock, jid, msg) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
  const mencionado = contextInfo.mentionedJid?.[0] || null;
  const respondido = contextInfo.participant || null;

  let objetivo = mencionado || respondido || null;
  if (!objetivo) return null;

  objetivo = await resolverJidReal(sock, jid, objetivo);
  return objetivo;
}

async function enviarReactionDelirius(sock, jid, msg, endpoint, captionBuilder) {
  const objetivo = await obtenerObjetivo(sock, jid, msg);

  if (!objetivo) {
    return sock.sendMessage(
      jid,
      { text: 'Debes mencionar a alguien o responder su mensaje para usar este comando.' },
      { quoted: msg }
    );
  }

  const json = await fetchJson(`https://api.delirius.store/reactions/${endpoint}`);

  if (!json?.status || !json?.data?.url) {
    throw new Error('La API no devolvio una URL valida');
  }

  const mediaUrl = json.data.url;
  const mentionTag = `@${objetivo.split('@')[0]}`;
  const caption = typeof captionBuilder === 'function'
    ? captionBuilder(mentionTag, objetivo, msg)
    : `Reaccion para ${mentionTag}`;

  const lower = mediaUrl.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return sock.sendMessage(
      jid,
      {
        video: { url: mediaUrl },
        caption,
        mentions: [objetivo],
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
      mentions: [objetivo]
    },
    { quoted: msg }
  );
}

module.exports = {
  fetchJson,
  obtenerObjetivo,
  enviarReactionDelirius
};

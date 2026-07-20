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

function elegirAleatorio(lista = []) {
  return lista[Math.floor(Math.random() * lista.length)];
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

  return await resolverJidReal(sock, jid, objetivo);
}

async function enviarReactionDelirius(sock, jid, msg, endpoint, frases = []) {
  const autor = await resolverJidReal(sock, jid, msg.key.participant || msg.key.remoteJid);
  const objetivo = await obtenerObjetivo(sock, jid, msg);

  if (!objetivo) {
    return sock.sendMessage(
      jid,
      { text: 'Debes mencionar a alguien o responder a su mensaje para usar este comando.' },
      { quoted: msg }
    );
  }

  if (!autor) {
    return sock.sendMessage(
      jid,
      { text: 'No pude identificar quien ejecuto el comando.' },
      { quoted: msg }
    );
  }

  const json = await fetchJson(`https://api.delirius.store/reactions/${endpoint}`);

  if (!json?.status || !json?.data?.url) {
    throw new Error('La API no devolvio una URL valida');
  }

  const mediaUrl = json.data.url;
  const tagAutor = `@${autor.split('@')[0]}`;
  const tagObjetivo = `@${objetivo.split('@')[0]}`;

  const plantilla = elegirAleatorio(frases) || `${tagAutor} hizo una reaccion a ${tagObjetivo}`;
  const caption = plantilla
    .replaceAll('{autor}', tagAutor)
    .replaceAll('{objetivo}', tagObjetivo);

  const lower = mediaUrl.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return sock.sendMessage(
      jid,
      {
        video: { url: mediaUrl },
        caption,
        mentions: [autor, objetivo],
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
      mentions: [autor, objetivo]
    },
    { quoted: msg }
  );
}

module.exports = {
  fetchJson,
  elegirAleatorio,
  obtenerObjetivo,
  enviarReactionDelirius
};

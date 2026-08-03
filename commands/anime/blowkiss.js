const { fetchEvogb } = require('../../lib/evogb');
const { error: cajaError } = require('../../lib/estilo');

// Helper para limpiar y formatear JID a usuario de WhatsApp (@s.whatsapp.net)
const formatJid = (jidStr) => {
  if (!jidStr || typeof jidStr !== 'string') return null;
  const clean = jidStr.split(':')[0].trim();
  if (clean.includes('@')) {
    const [user, domain] = clean.split('@');
    if (domain === 's.whatsapp.net' || domain === 'c.us') {
      return `${user}@s.whatsapp.net`;
    }
    return clean;
  }
  const digits = clean.replace(/[^0-9]/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
};

// Helper para obtener contextInfo de cualquier tipo de mensaje
const getContextInfo = (m) => {
  const msgObj = m?.message?.ephemeralMessage?.message || 
                 m?.message?.viewOnceMessage?.message || 
                 m?.message?.viewOnceMessageV2?.message ||
                 m?.message?.documentWithCaptionMessage?.message ||
                 m?.message;
  if (!msgObj) return null;
  for (const key of Object.keys(msgObj)) {
    if (msgObj[key] && typeof msgObj[key] === 'object' && msgObj[key].contextInfo) {
      return msgObj[key].contextInfo;
    }
  }
  return null;
};

// Helper para obtener el JID real del remitente
const getSenderJid = (sock, msg, jid) => {
  let sender = msg.key?.participant || msg.participant;
  if (!sender) {
    if (msg.key?.fromMe) {
      sender = sock.user?.id || sock.user?.jid;
    } else if (msg.key?.remoteJid && !msg.key.remoteJid.endsWith('@g.us')) {
      sender = msg.key.remoteJid;
    }
  }
  return formatJid(sender);
};

// Helper para determinar el JID del objetivo (mención, respuesta o número)
const getTargetJid = (msg, texto) => {
  const contextInfo = getContextInfo(msg);
  
  if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
    const target = formatJid(contextInfo.mentionedJid[0]);
    if (target) return target;
  }
  
  if (contextInfo?.participant) {
    const target = formatJid(contextInfo.participant);
    if (target) return target;
  }
  
  const args = texto.trim().split(/\s+/).slice(1).join(' ').trim();
  if (args) {
    const digits = args.replace(/[^0-9]/g, '');
    if (digits.length >= 7) {
      return `${digits}@s.whatsapp.net`;
    }
  }
  
  return null;
};

module.exports = {
  name: 'snuggle',
  aliases: ['acurrucar', 'acurrucarse'],
  category: 'anime',
  description: 'Reacción anime de acurrucarse. Uso: .snuggle [@usuario]',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    try {
      // 1. Obtener remitente
      const senderJid = getSenderJid(sock, msg, jid);
      const senderNum = senderJid ? senderJid.split('@')[0] : '';
      const senderTag = senderNum ? `@${senderNum}` : 'Alguien';

      // 2. Obtener objetivo
      const targetJid = getTargetJid(msg, texto);
      const hasTarget = Boolean(targetJid && targetJid !== senderJid);
      const targetNum = hasTarget ? targetJid.split('@')[0] : null;
      const targetTag = targetNum ? `@${targetNum}` : null;

      // 3. Crear lista de menciones para que WhatsApp reemplace los @numero con los nombres reales
      const mentionsSet = new Set();
      if (senderJid) mentionsSet.add(senderJid);
      if (hasTarget && targetJid) mentionsSet.add(targetJid);
      const mentions = Array.from(mentionsSet);

      // 4. Consultar API de reacción
      const res = await fetchEvogb('https://api.evogb.org/sfw/interaction?type=snuggle');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data || !data.status || !data.result) {
        throw new Error('Respuesta inválida de la API');
      }

      const videoUrl = data.result;

      // 5. Generar frases dinámicas de la interacción
      let mensajeTexto = '';
      if (hasTarget) {
        const frasesConObjetivo = [
          `${senderTag} se acurruca tiernamente con ${targetTag} 🥰✨`,
          `${senderTag} busca el calor de ${targetTag} y se acurruca a su lado 💕`,
          `¡Aww! ${senderTag} se ha acurrucado muy juntito a ${targetTag} 💖`,
          `${senderTag} le da un abracito calientito y se acurruca con ${targetTag} 🫂💗`
        ];
        mensajeTexto = frasesConObjetivo[Math.floor(Math.random() * frasesConObjetivo.length)];
      } else {
        const frasesSolitario = [
          `${senderTag} busca con quién acurrucarse hoy... 🥺✨`,
          `${senderTag} se acurruca solito con su cobijita 💕`,
          `¡${senderTag} necesita un abracito para acurrucarse! 💖`,
          `${senderTag} se acurruca en un rincón esperando mimos 🧸`
        ];
        mensajeTexto = frasesSolitario[Math.floor(Math.random() * frasesSolitario.length)];
      }

      // 6. Enviar video/GIF con la etiqueta y menciones habilitadas
      await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: mensajeTexto,
        gifPlayback: true,
        mentions
      }, { quoted: msg });

    } catch (err) {
      console.error('Error en comando snuggle:', err);
      await sock.sendMessage(jid, {
        text: cajaError('No se pudo obtener la reacción anime en este momento.')
      }, { quoted: msg });
    }
  }
};
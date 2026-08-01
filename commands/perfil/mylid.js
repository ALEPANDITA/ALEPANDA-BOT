const { resolverLid } = require('../../lib/permisos');

function esLid(id) {
  return !!id && id.endsWith('@lid');
}

// En grupos, WhatsApp a veces solo manda el LID del remitente (por privacidad),
// pero la metadata del grupo trae el numero real junto al LID de cada participante.
async function buscarParDesdeGrupo(sock, jidChat, remitente) {
  if (!jidChat.endsWith('@g.us')) return null;
  try {
    const metadata = await sock.groupMetadata(jidChat);
    const numRemitente = remitente.split('@')[0];
    const participante = metadata.participants.find((p) => {
      const pId = (p.id || '').split('@')[0];
      const pPhone = (p.phoneNumber || p.jid || '').split('@')[0];
      return pId === numRemitente || pPhone === numRemitente;
    });
    if (!participante) return null;
    return {
      id: participante.id || null,
      phoneNumber: participante.phoneNumber || participante.jid || null
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'mylid',
  aliases: ['midlid', 'mijid', 'lid'],
  category: 'perfil',
  description: 'Te muestra tu JID (numero) y tu LID de WhatsApp',
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const alterno = msg.key.participantAlt || msg.key.remoteJidAlt || null;

    let numeroJid = esLid(remitente) ? alterno : remitente;
    let lid = esLid(remitente) ? remitente : alterno;

    if (!numeroJid || !lid) {
      const par = await buscarParDesdeGrupo(sock, jid, remitente);
      if (par) {
        if (esLid(par.id)) {
          lid = lid || par.id;
          if (par.phoneNumber) numeroJid = numeroJid || par.phoneNumber;
        } else if (par.id) {
          numeroJid = numeroJid || par.id;
        }
      }
    }

    if (!numeroJid || !lid) {
      try {
        const resuelto = await resolverLid(sock, remitente);
        if (esLid(resuelto)) {
          lid = lid || resuelto;
        } else if (resuelto) {
          numeroJid = numeroJid || resuelto;
        }
      } catch (e) {
      }
    }

    if (!numeroJid && !esLid(remitente)) numeroJid = remitente;
    if (!lid && esLid(remitente)) lid = remitente;

    const lineas = ['🪪 *Tu identificacion en WhatsApp*', ''];
    lineas.push(`📱 JID (numero): ${numeroJid ? `\`${numeroJid}\`` : 'no se pudo obtener (tu privacidad en WhatsApp puede estar ocultando tu numero incluso para el bot)'}`);
    lineas.push(`🆔 LID: ${lid ? `\`${lid}\`` : 'no se pudo obtener'}`);

    await sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
  }
};

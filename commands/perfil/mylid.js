const { resolverLid } = require('../../lib/permisos');

function esLid(id) {
  return !!id && id.endsWith('@lid');
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

    if (!lid || !numeroJid) {
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
    lineas.push(`📱 JID (numero): ${numeroJid ? `\`${numeroJid}\`` : 'no se pudo obtener'}`);
    lineas.push(`🆔 LID: ${lid ? `\`${lid}\`` : 'no se pudo obtener (puede que tu cuenta no tenga uno, o WhatsApp no respondio a tiempo)'}`);

    await sock.sendMessage(jid, { text: lineas.join('\n') }, { quoted: msg });
  }
};

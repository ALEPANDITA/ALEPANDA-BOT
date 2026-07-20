const { leerDB, getUsuario } = require('../../lib/db');
const { propuestasPorMensaje, TIEMPO_EXPIRA } = require('../../lib/matrimonio');

module.exports = {
  name: 'casar',
  category: 'perfil',
  description: 'Propon matrimonio a alguien (menciona o responde a la persona). Ella debe responder tu mensaje con "si" o "no"',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, { text: 'Menciona o responde a la persona con la que te quieres casar.' }, { quoted: msg });
    }

    if (objetivo.split('@')[0] === remitente.split('@')[0]) {
      return sock.sendMessage(jid, { text: 'No te puedes casar contigo mismo jaja.' }, { quoted: msg });
    }

    const db = leerDB();
    const perfilRemitente = getUsuario(db, remitente);
    const perfilObjetivo = getUsuario(db, objetivo);

    if (perfilRemitente.pareja) {
      return sock.sendMessage(jid, { text: 'Ya estas casado/a. Usa .divorciar si quieres terminar tu relacion actual.' }, { quoted: msg });
    }
    if (perfilObjetivo.pareja) {
      return sock.sendMessage(jid, { text: 'Esa persona ya esta casada con alguien mas.' }, { quoted: msg });
    }

    const enviado = await sock.sendMessage(jid, {
      text: `💍 @${remitente.split('@')[0]} le propuso matrimonio a @${objetivo.split('@')[0]}!\n\n@${objetivo.split('@')[0]}, responde este mensaje con *si* o *no* (tienes 5 minutos).`,
      mentions: [remitente, objetivo]
    });

    const idMensaje = enviado?.key?.id;
    if (idMensaje) {
      propuestasPorMensaje.set(idMensaje, {
        de: remitente,
        para: objetivo,
        jid,
        expira: Date.now() + TIEMPO_EXPIRA
      });

      setTimeout(() => {
        propuestasPorMensaje.delete(idMensaje);
      }, TIEMPO_EXPIRA);
    }
  }
};

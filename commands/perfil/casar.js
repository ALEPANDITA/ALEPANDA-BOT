const { leerDB, getUsuario } = require('../../lib/db');
const { propuestasPorMensaje, tienePropuestaActiva, TIEMPO_EXPIRA } = require('../../lib/matrimonio');

module.exports = {
  name: 'casar',
  category: 'perfil',
  description: 'Propone matrimonio a alguien (mencionalo o responde a su mensaje). Debe contestar "si" para aceptar.',
  execute: async (sock, jid, msg, { prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;

    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const objetivo = mencionado || citado;

    if (!objetivo) {
      return sock.sendMessage(jid, {
        text: `Menciona a la persona o responde a su mensaje.\nEj: ${prefix}casar @usuario`
      }, { quoted: msg });
    }

    if (objetivo.split('@')[0] === remitente.split('@')[0]) {
      return sock.sendMessage(jid, { text: 'No puedes casarte contigo mismo/a. 😅' }, { quoted: msg });
    }

    const db = leerDB();
    const perfilRemitente = getUsuario(db, remitente);
    const perfilObjetivo = getUsuario(db, objetivo);

    if (perfilRemitente.pareja) {
      return sock.sendMessage(jid, { text: 'Ya estas casado/a. Usa el comando de divorcio si quieres separarte primero.' }, { quoted: msg });
    }

    if (perfilObjetivo.pareja) {
      return sock.sendMessage(jid, { text: 'Esa persona ya esta casada con alguien mas.' }, { quoted: msg });
    }

    if (tienePropuestaActiva(remitente.split('@')[0]) || tienePropuestaActiva(objetivo.split('@')[0])) {
      return sock.sendMessage(jid, { text: 'Ya hay una propuesta de matrimonio pendiente para alguna de las dos personas. Espera a que se resuelva.' }, { quoted: msg });
    }

    const minutos = Math.round(TIEMPO_EXPIRA / 60000);
    const enviado = await sock.sendMessage(jid, {
      text: `💍 @${remitente.split('@')[0]} le propone matrimonio a @${objetivo.split('@')[0]}!\n\n` +
        `@${objetivo.split('@')[0]}, responde a *este mensaje* con "si" para aceptar, o "no" para rechazar.\n` +
        `⏳ Tienes ${minutos} minutos antes de que expire.`,
      mentions: [remitente, objetivo]
    }, { quoted: msg });

    const stanzaId = enviado.key.id;
    propuestasPorMensaje.set(stanzaId, {
      de: remitente,
      para: objetivo,
      jid,
      timestamp: Date.now()
    });
  }
};

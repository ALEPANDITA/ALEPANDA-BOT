const {
  NOMBRE_SIMI,
  NOMBRE_PANDA,
  NOMBRE_SIMON,
  NOMBRE_CUPIDO,
  SYSTEM_PROMPT_SIMI,
  SYSTEM_PROMPT_PANDA,
  SYSTEM_PROMPT_SIMON,
  SYSTEM_PROMPT_CUPIDO,
  historialesSimi,
  historialesPanda,
  historialesSimon,
  historialesCupido,
  HORAS_EXPIRACION,
  claveDe,
  generarRespuesta,
  quiereInvitarSimi,
  quiereInvitarSimon,
  quiereInvitarCupido,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  invitarYResponder
} = require('../../lib/iaAmigos');

// Amigos que Panda puede traer a la conversacion (todos pueden rebotarse respuestas entre si)
const AMIGOS = [
  { detectar: quiereInvitarSimi, nombre: NOMBRE_SIMI, systemPrompt: SYSTEM_PROMPT_SIMI, historial: historialesSimi, emoji: '😈' },
  { detectar: quiereInvitarSimon, nombre: NOMBRE_SIMON, systemPrompt: SYSTEM_PROMPT_SIMON, historial: historialesSimon, emoji: '🧘' },
  { detectar: quiereInvitarCupido, nombre: NOMBRE_CUPIDO, systemPrompt: SYSTEM_PROMPT_CUPIDO, historial: historialesCupido, emoji: '💘' }
];

module.exports = {
  name: 'panda',
  category: 'ia',
  description: 'Habla con Panda, una IA buena onda y respetuosa. Soporta @mencion, @all/@todos y puede traer a Simi, Simon o Cupido a la conversacion',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const clave = claveDe(jid, remitente);

    let mensaje = texto.slice((prefix + 'panda').length).trim();

    if (mensaje.toLowerCase() === 'reset' || mensaje.toLowerCase() === 'reiniciar') {
      historialesPanda.set(clave, []);
      return sock.sendMessage(jid, { text: 'Listo, borre nuestra conversacion, empezamos de cero.' }, { quoted: msg });
    }

    if (!mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}panda <mensaje>\nEjemplo: ${prefix}panda que onda\nTambien puedes: ${prefix}panda @persona <mensaje> o ${prefix}panda @all <mensaje>\nY puedes decirle "trae a simi", "trae a simon" o "trae a cupido" en tu mensaje para que tambien opinen\n\n${prefix}panda reset para borrar tu conversacion\n\n(Cada persona tiene su propia conversacion con Panda, y se olvida de todo despues de ${HORAS_EXPIRACION} horas sin hablarle)`
      }, { quoted: msg });
    }

    const mensajeOriginal = mensaje;

    // Detectar menciones especificas (@persona) que WhatsApp ya resuelve como mentionedJid
    let mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Detectar @all / @todos como texto literal -> mencionar a todo el grupo
    const pideTodos = /(^|\s)@(all|todos)(\s|$)/i.test(mensaje);
    const esGrupo = jid.endsWith('@g.us');
    const esTodos = pideTodos && esGrupo;

    if (esTodos) {
      try {
        const metadata = await sock.groupMetadata(jid);
        mencionados = metadata.participants
          .map(p => p.id)
          .filter(id => id !== sock.user?.id?.replace(/:\d+/, '') + '@s.whatsapp.net' && id.split('@')[0] !== (sock.user?.id || '').split(':')[0]);
      } catch (err) {
        console.error('No se pudo obtener la lista del grupo para @all:', err);
      }
      mensaje = mensaje.replace(/(^|\s)@(all|todos)(\s|$)/gi, ' ').trim();
    }

    try {
      await sock.sendMessage(jid, { react: { text: '🐼', key: msg.key } });

      const etiquetasTags = esTodos ? [] : await resolverEtiquetasTags(sock, jid, mencionados, esGrupo);
      const mensajeParaIA = armarMensajeParaIA(mensaje, { esTodos, etiquetasTags });

      const respuesta = await generarRespuesta(SYSTEM_PROMPT_PANDA, historialesPanda, clave, mensajeParaIA, mensaje);
      const textoFinal = armarTextoFinal(respuesta, { esTodos, etiquetasTags });

      await sock.sendMessage(jid, { text: textoFinal, mentions: mencionados }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

      // Si en el mensaje original piden traer a algun amigo, lo metemos a la conversacion
      // (y ese amigo le rebota la respuesta de vuelta a Panda, y viceversa)
      for (const amigo of AMIGOS) {
        if (amigo.detectar(mensajeOriginal)) {
          await invitarYResponder(sock, jid, msg, {
            clave, mensaje, mencionados, etiquetasTags, esTodos,
            nombreAnfitrion: NOMBRE_PANDA, systemPromptAnfitrion: SYSTEM_PROMPT_PANDA, historialAnfitrion: historialesPanda, emojiAnfitrion: '🐼',
            nombreInvitado: amigo.nombre, systemPromptInvitado: amigo.systemPrompt, historialInvitado: amigo.historial, emojiInvitado: amigo.emoji,
            respuestaAnfitrion: respuesta
          });
        }
      }
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, {
          text: `No hay una API key de Gemini configurada.\nUn owner puede activarla con: ${prefix}setapikey gemini TU_CLAVE`
        }, { quoted: msg });
      }
      console.error(err);
      await sock.sendMessage(jid, { text: `Ocurrio un error: ${err.message}` }, { quoted: msg });
    }
  }
};

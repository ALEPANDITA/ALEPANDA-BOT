const {
  NOMBRE_SIMI,
  NOMBRE_PANDA,
  NOMBRE_SIMON,
  SYSTEM_PROMPT_SIMI,
  SYSTEM_PROMPT_PANDA,
  SYSTEM_PROMPT_SIMON,
  historialesSimi,
  historialesPanda,
  historialesSimon,
  HORAS_EXPIRACION,
  claveDe,
  generarRespuesta,
  quiereInvitarSimi,
  quiereInvitarPanda,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  armarMensajeParaInvitado
} = require('../../lib/iaAmigos');

module.exports = {
  name: 'simon',
  category: 'ia',
  description: 'Habla con Simon, una IA tranquila y calmada (pero seria si la hacen enojar). Soporta @mencion, @all/@todos y puede traer a Simi o a Panda a la conversacion',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const clave = claveDe(jid, remitente);

    let mensaje = texto.slice((prefix + 'simon').length).trim();

    if (mensaje.toLowerCase() === 'reset' || mensaje.toLowerCase() === 'reiniciar') {
      historialesSimon.set(clave, []);
      return sock.sendMessage(jid, { text: 'Listo, borre nuestra conversacion, empezamos de cero.' }, { quoted: msg });
    }

    if (!mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}simon <mensaje>\nEjemplo: ${prefix}simon que onda\nTambien puedes: ${prefix}simon @persona <mensaje> o ${prefix}simon @all <mensaje>\nY puedes decirle "trae a simi" o "trae a panda" en tu mensaje para que tambien opinen\n\n${prefix}simon reset para borrar tu conversacion\n\n(Cada persona tiene su propia conversacion con Simón, y se olvida de todo despues de ${HORAS_EXPIRACION} horas sin hablarle)`
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
      await sock.sendMessage(jid, { react: { text: '🧘', key: msg.key } });

      const etiquetasTags = esTodos ? [] : await resolverEtiquetasTags(sock, jid, mencionados, esGrupo);
      const mensajeParaIA = armarMensajeParaIA(mensaje, { esTodos, etiquetasTags });

      const respuesta = await generarRespuesta(SYSTEM_PROMPT_SIMON, historialesSimon, clave, mensajeParaIA, mensaje);
      const textoFinal = armarTextoFinal(respuesta, { esTodos, etiquetasTags });

      await sock.sendMessage(jid, { text: textoFinal, mentions: mencionados }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

      // Si en el mensaje original piden traer a Simi, lo metemos a la conversacion
      if (quiereInvitarSimi(mensajeOriginal)) {
        try {
          const mensajeParaSimi = armarMensajeParaInvitado({
            nombreAnfitrion: NOMBRE_SIMON,
            mensajeUsuario: mensaje,
            respuestaAnfitrion: respuesta
          });
          const respuestaSimi = await generarRespuesta(SYSTEM_PROMPT_SIMI, historialesSimi, clave, mensajeParaSimi, mensaje);
          const textoFinalSimi = armarTextoFinal(respuestaSimi, { esTodos, etiquetasTags });
          await sock.sendMessage(jid, { text: `😈 *${NOMBRE_SIMI}:* ${textoFinalSimi}`, mentions: mencionados }, { quoted: msg });
        } catch (err) {
          console.error('No se pudo traer a Simi a la conversacion:', err);
          const motivo = err.code === 'NO_API_KEY'
            ? 'no hay API key de Gemini configurada'
            : err.message || 'error desconocido';
          await sock.sendMessage(jid, { text: `⚠️ Intente traer a Simi pero fallo (${motivo})` }, { quoted: msg });
        }
      }

      // Si en el mensaje original piden traer a Panda, lo metemos a la conversacion
      if (quiereInvitarPanda(mensajeOriginal)) {
        try {
          const mensajeParaPanda = armarMensajeParaInvitado({
            nombreAnfitrion: NOMBRE_SIMON,
            mensajeUsuario: mensaje,
            respuestaAnfitrion: respuesta
          });
          const respuestaPanda = await generarRespuesta(SYSTEM_PROMPT_PANDA, historialesPanda, clave, mensajeParaPanda, mensaje);
          const textoFinalPanda = armarTextoFinal(respuestaPanda, { esTodos, etiquetasTags });
          await sock.sendMessage(jid, { text: `🐼 *${NOMBRE_PANDA}:* ${textoFinalPanda}`, mentions: mencionados }, { quoted: msg });
        } catch (err) {
          console.error('No se pudo traer a Panda a la conversacion:', err);
          const motivo = err.code === 'NO_API_KEY'
            ? 'no hay API key de Gemini configurada'
            : err.message || 'error desconocido';
          await sock.sendMessage(jid, { text: `⚠️ Intente traer a Panda pero fallo (${motivo})` }, { quoted: msg });
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

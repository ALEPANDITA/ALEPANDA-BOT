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
  quiereInvitarPanda,
  quiereInvitarSimon,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  armarMensajeParaInvitado,
  armarMensajeParaRespuestaDirecta
} = require('../../lib/iaAmigos');

module.exports = {
  name: 'simi',
  category: 'ia',
  description: 'Habla con Simi, una IA grosera y sarcastica. Soporta @mencion, @all/@todos y puede traer a Panda a la conversacion',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const clave = claveDe(jid, remitente);

    let mensaje = texto.slice((prefix + 'simi').length).trim();

    if (mensaje.toLowerCase() === 'reset' || mensaje.toLowerCase() === 'reiniciar') {
      historialesSimi.set(clave, []);
      return sock.sendMessage(jid, { text: 'Ya se me borro TU memoria, empezamos de cero contigo.' }, { quoted: msg });
    }

    if (!mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}simi <mensaje>\nEjemplo: ${prefix}simi que onda\nTambien puedes: ${prefix}simi @persona <mensaje> o ${prefix}simi @all <mensaje>\nY puedes decirle "trae a panda" o "trae a simon" en tu mensaje para que tambien opinen\n\n${prefix}simi reset para borrar tu conversacion\n\n(Cada persona tiene su propia conversacion con Simi, y se olvida de todo despues de ${HORAS_EXPIRACION} horas sin hablarle)`
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
      await sock.sendMessage(jid, { react: { text: '💬', key: msg.key } });

      const etiquetasTags = esTodos ? [] : await resolverEtiquetasTags(sock, jid, mencionados, esGrupo);
      const mensajeParaIA = armarMensajeParaIA(mensaje, { esTodos, etiquetasTags });

      const respuesta = await generarRespuesta(SYSTEM_PROMPT_SIMI, historialesSimi, clave, mensajeParaIA, mensaje);
      const textoFinal = armarTextoFinal(respuesta, { esTodos, etiquetasTags });

      await sock.sendMessage(jid, { text: textoFinal, mentions: mencionados }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

      // Si en el mensaje original piden traer a Panda, lo metemos a la conversacion
      if (quiereInvitarPanda(mensajeOriginal)) {
        try {
          const mensajeParaPanda = armarMensajeParaInvitado({
            nombreAnfitrion: NOMBRE_SIMI,
            mensajeUsuario: mensaje,
            respuestaAnfitrion: respuesta
          });
          const respuestaPanda = await generarRespuesta(SYSTEM_PROMPT_PANDA, historialesPanda, clave, mensajeParaPanda, mensaje);
          const textoFinalPanda = armarTextoFinal(respuestaPanda, { esTodos, etiquetasTags });
          await sock.sendMessage(jid, { text: `🐼 *Panda:* ${textoFinalPanda}`, mentions: mencionados }, { quoted: msg });
        } catch (err) {
          console.error('No se pudo traer a Panda a la conversacion:', err);
          const motivo = err.code === 'NO_API_KEY'
            ? 'no hay API key de Gemini configurada'
            : err.message || 'error desconocido';
          await sock.sendMessage(jid, { text: `⚠️ Intente traer a Panda pero fallo (${motivo})` }, { quoted: msg });
        }
      }

      // Si en el mensaje original piden traer a Simon, lo metemos a la conversacion
      if (quiereInvitarSimon(mensajeOriginal)) {
        try {
          const mensajeParaSimon = armarMensajeParaInvitado({
            nombreAnfitrion: NOMBRE_SIMI,
            mensajeUsuario: mensaje,
            respuestaAnfitrion: respuesta
          });
          const respuestaSimon = await generarRespuesta(SYSTEM_PROMPT_SIMON, historialesSimon, clave, mensajeParaSimon, mensaje);
          const textoFinalSimon = armarTextoFinal(respuestaSimon, { esTodos, etiquetasTags });
          await sock.sendMessage(jid, { text: `🧘 *${NOMBRE_SIMON}:* ${textoFinalSimon}`, mentions: mencionados }, { quoted: msg });

          // Simi no se queda callado: le responde de vuelta a Simon (con su sarcasmo
          // de siempre, pero con la cautela/nervios que le tiene).
          try {
            const mensajeDeVuelta = armarMensajeParaRespuestaDirecta({
              nombreOtroBot: NOMBRE_SIMON,
              mensajeUsuario: mensaje,
              respuestaOtroBot: respuestaSimon
            });
            const respuestaSimiDeVuelta = await generarRespuesta(SYSTEM_PROMPT_SIMI, historialesSimi, clave, mensajeDeVuelta, mensaje);
            const textoFinalSimiDeVuelta = armarTextoFinal(respuestaSimiDeVuelta, { esTodos, etiquetasTags });
            await sock.sendMessage(jid, { text: `😈 *Simi:* ${textoFinalSimiDeVuelta}`, mentions: mencionados }, { quoted: msg });
          } catch (err) {
            // Si esto falla no mandamos otro mensaje de error, ya se mostro el de Simon arriba.
            console.error('No se pudo generar la respuesta de vuelta de Simi hacia Simon:', err);
          }
        } catch (err) {
          console.error('No se pudo traer a Simon a la conversacion:', err);
          const motivo = err.code === 'NO_API_KEY'
            ? 'no hay API key de Gemini configurada'
            : err.message || 'error desconocido';
          await sock.sendMessage(jid, { text: `⚠️ Intente traer a Simón pero fallo (${motivo})` }, { quoted: msg });
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

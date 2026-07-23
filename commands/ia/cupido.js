const { generarTexto } = require('../../lib/gemini');
const { formatearBuffer } = require('../../lib/simonWatcher');
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
  quiereInvitarPanda,
  quiereInvitarSimon,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  invitarYResponder
} = require('../../lib/iaAmigos');

// Amigos que Cupido puede traer a la conversacion (todos pueden rebotarse respuestas entre si)
const AMIGOS = [
  { detectar: quiereInvitarSimi, nombre: NOMBRE_SIMI, systemPrompt: SYSTEM_PROMPT_SIMI, historial: historialesSimi, emoji: '😈' },
  { detectar: quiereInvitarPanda, nombre: NOMBRE_PANDA, systemPrompt: SYSTEM_PROMPT_PANDA, historial: historialesPanda, emoji: '🐼' },
  { detectar: quiereInvitarSimon, nombre: NOMBRE_SIMON, systemPrompt: SYSTEM_PROMPT_SIMON, historial: historialesSimon, emoji: '🧘' }
];

// Da un piropo carismatico. Si le pasan @persona, se lo dedica a ella.
async function manejarPiropo(sock, jid, msg, { prefix, argumento, mencionados }) {
  const dedicatoria = mencionados.length
    ? `Dedicaselo directamente a la persona etiquetada, dirigete a ella como "tu". Incluye en algun punto natural, exactamente una vez, este texto tal cual: ${mencionados.map(id => `@${id.split('@')[0]}`).join(' ')} -- sin comillas, como si la etiquetaras en WhatsApp.`
    : 'No te dieron una persona especifica, asi que da un piropo carismatico y bonito en general (puede ser para quien lo pidio).';

  const tema = argumento ? ` El piropo debe relacionarse con esto si aplica: "${argumento}".` : '';

  const prompt = `Eres Cupido, un chatbot romantico, carismatico y feliz de un grupo de WhatsApp. Te piden un piropo. ${dedicatoria}${tema} Dalo corto (1-2 lineas), ingenioso, favorecedor y respetuoso -- nunca vulgar, nunca sexual, nunca incomodo. Responde SOLO con el piropo, sin explicaciones ni comillas.`;

  const respuesta = await generarTexto(prompt);
  const mencionesTags = mencionados.map(id => `@${id.split('@')[0]}`);
  const faltantes = mencionesTags.filter(tag => !respuesta.includes(tag));
  const textoFinal = faltantes.length ? `${respuesta} ${faltantes.join(' ')}` : respuesta;

  await sock.sendMessage(jid, { text: `💘 ${textoFinal}`, mentions: mencionados }, { quoted: msg });
}

// Escribe un poema corto sobre el tema que le pidan (o de amor/amistad en general).
async function manejarPoema(sock, jid, msg, { argumento }) {
  const tema = argumento || 'el amor y la amistad entre este grupo de amigos';
  const prompt = `Eres Cupido, un chatbot romantico, carismatico y feliz de un grupo de WhatsApp. Escribe un poema corto (4 a 8 lineas), original y bonito sobre: "${tema}". Que suene calido y genuino, no cursi en exceso ni de mal gusto, nada sexual. Responde SOLO con el poema, sin titulo, sin explicaciones ni comillas.`;

  const respuesta = await generarTexto(prompt);
  await sock.sendMessage(jid, { text: `💘 *Cupido dice:*\n\n${respuesta}` }, { quoted: msg });
}

// Lee el buffer reciente de mensajes del grupo (el mismo que usa el vigilante de Simon)
// y da un consejo de amor/conversacion basado en lo que ha visto en el chat.
async function manejarConsejo(sock, jid, msg, { prefix }) {
  const conversacion = formatearBuffer(jid);

  if (!conversacion) {
    return sock.sendMessage(jid, {
      text: 'Todavia no eh visto suficiente conversacion reciente en este chat como para darte un consejo. Hablen un rato y vuelve a preguntarme 💘'
    }, { quoted: msg });
  }

  const prompt = `Eres Cupido, un chatbot romantico, carismatico y feliz de un grupo de amigos en WhatsApp. Alguien te pidio un consejo de amor o de conversacion basado en lo que se ha estado hablando en el grupo. Estos son los mensajes recientes del chat (el mas reciente al final):\n"""${conversacion}"""\n\nDa un consejo corto, especifico y util basado en esa conversacion (por ejemplo sobre como seguirle hablando a alguien, como declararse, como animarse, o simplemente animo). No repitas literalmente los mensajes ni digas que "estuviste leyendo el chat" de forma rara -- hazlo de forma natural, como el amigo carismatico que se dio cuenta de la situacion. Si de plano no hay nada romantico o util en la conversacion, dilo con humor y buena onda en vez de inventar algo.`;

  const respuesta = await generarTexto(prompt);
  await sock.sendMessage(jid, { text: `💘 *Cupido:* ${respuesta}` }, { quoted: msg });
}

module.exports = {
  name: 'cupido',
  category: 'ia',
  description: 'Habla con Cupido, una IA feliz y romantica que da piropos, poemas y consejos de amor. Soporta @mencion, @all/@todos, subcomandos (piropo/poema/consejo) y puede traer a Simi, Panda o Simon',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const clave = claveDe(jid, remitente);

    let mensaje = texto.slice((prefix + 'cupido').length).trim();
    const mencionadosOriginal = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mensaje.toLowerCase() === 'reset' || mensaje.toLowerCase() === 'reiniciar') {
      historialesCupido.set(clave, []);
      return sock.sendMessage(jid, { text: 'Listo, borre nuestra conversacion, empezamos de cero 💘' }, { quoted: msg });
    }

    const [subcomando, ...resto] = mensaje.split(/\s+/);
    const subcomandoLower = (subcomando || '').toLowerCase();
    const argumento = resto.join(' ').replace(/@\d+/g, '').trim();

    try {
      if (subcomandoLower === 'piropo') {
        await sock.sendMessage(jid, { react: { text: '💘', key: msg.key } });
        await manejarPiropo(sock, jid, msg, { prefix, argumento, mencionados: mencionadosOriginal });
        return await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      }

      if (subcomandoLower === 'poema') {
        await sock.sendMessage(jid, { react: { text: '💘', key: msg.key } });
        await manejarPoema(sock, jid, msg, { argumento });
        return await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      }

      if (subcomandoLower === 'consejo') {
        await sock.sendMessage(jid, { react: { text: '💘', key: msg.key } });
        await manejarConsejo(sock, jid, msg, { prefix });
        return await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      }
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      if (err.code === 'NO_API_KEY') {
        return sock.sendMessage(jid, {
          text: `No hay una API key de Gemini configurada.\nUn owner puede activarla con: ${prefix}setapikey gemini TU_CLAVE`
        }, { quoted: msg });
      }
      console.error(err);
      return sock.sendMessage(jid, { text: `Ocurrio un error: ${err.message}` }, { quoted: msg });
    }

    if (!mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}cupido <mensaje>\nEjemplo: ${prefix}cupido que onda\nTambien puedes: ${prefix}cupido @persona <mensaje> o ${prefix}cupido @all <mensaje>\n\nSubcomandos:\n${prefix}cupido piropo [@persona]\n${prefix}cupido poema [tema]\n${prefix}cupido consejo (lee el chat reciente y da un consejo de amor)\n\nY puedes decirle "trae a simi", "trae a panda" o "trae a simon" en tu mensaje para que tambien opinen\n\n${prefix}cupido reset para borrar tu conversacion\n\n(Cada persona tiene su propia conversacion con Cupido, y se olvida de todo despues de ${HORAS_EXPIRACION} horas sin hablarle)`
      }, { quoted: msg });
    }

    const mensajeOriginal = mensaje;

    // Detectar menciones especificas (@persona) que WhatsApp ya resuelve como mentionedJid
    let mencionados = mencionadosOriginal;

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
      await sock.sendMessage(jid, { react: { text: '💘', key: msg.key } });

      const etiquetasTags = esTodos ? [] : await resolverEtiquetasTags(sock, jid, mencionados, esGrupo);
      const mensajeParaIA = armarMensajeParaIA(mensaje, { esTodos, etiquetasTags });

      const respuesta = await generarRespuesta(SYSTEM_PROMPT_CUPIDO, historialesCupido, clave, mensajeParaIA, mensaje);
      const textoFinal = armarTextoFinal(respuesta, { esTodos, etiquetasTags });

      await sock.sendMessage(jid, { text: textoFinal, mentions: mencionados }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

      // Si en el mensaje original piden traer a algun amigo, lo metemos a la conversacion
      // (y ese amigo le rebota la respuesta de vuelta a Cupido, y viceversa)
      for (const amigo of AMIGOS) {
        if (amigo.detectar(mensajeOriginal)) {
          await invitarYResponder(sock, jid, msg, {
            clave, mensaje, mencionados, etiquetasTags, esTodos,
            nombreAnfitrion: NOMBRE_CUPIDO, systemPromptAnfitrion: SYSTEM_PROMPT_CUPIDO, historialAnfitrion: historialesCupido, emojiAnfitrion: '💘',
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

const { chatConPersonalidad } = require('../../lib/gemini');

const SYSTEM_PROMPT = `Eres "Simi", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres grosero, sarcastico, burlon y respondon. Usas groserias, modismos y lenguaje callejero en español con libertad y sin filtro de "lenguaje bonito".
- Tienes actitud, contestas con humor negro, sarcasmo y burla ligera.
- Si te insultan, respondes con más sarcasmo, no te ofendes.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), igual ayudas de forma util, solo que con tu tono grosero y directo, no evadas dar la respuesta real.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas). El sarcasmo es hacia la conversacion/situacion, no un ataque personal destructivo.
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), dejas la actitud grosera de inmediato y respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

// Memoria separada por PERSONA dentro de cada chat/grupo, con expiracion por tiempo.
const historiales = new Map();
const MAX_MENSAJES = 8;
const HORAS_EXPIRACION = 5;
const MS_EXPIRACION = HORAS_EXPIRACION * 60 * 60 * 1000;

function claveDe(jid, remitente) {
  return `${jid}::${remitente}`;
}

function obtenerHistorial(clave) {
  if (!historiales.has(clave)) historiales.set(clave, []);
  const historial = historiales.get(clave);

  const ahora = Date.now();
  while (historial.length && (ahora - historial[0].timestamp) > MS_EXPIRACION) {
    historial.shift();
  }

  return historial;
}

module.exports = {
  name: 'simi',
  category: 'ia',
  description: 'Habla con Simi, una IA grosera y sarcastica. Soporta @mencion y @all/@todos',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const clave = claveDe(jid, remitente);

    let mensaje = texto.slice((prefix + 'simi').length).trim();

    if (mensaje.toLowerCase() === 'reset' || mensaje.toLowerCase() === 'reiniciar') {
      historiales.set(clave, []);
      return sock.sendMessage(jid, { text: 'Ya se me borro TU memoria, empezamos de cero contigo.' }, { quoted: msg });
    }

    if (!mensaje) {
      return sock.sendMessage(jid, {
        text: `Uso: ${prefix}simi <mensaje>\nEjemplo: ${prefix}simi que onda\nTambien puedes: ${prefix}simi @persona <mensaje> o ${prefix}simi @all <mensaje>\n\n${prefix}simi reset para borrar tu conversacion\n\n(Cada persona tiene su propia conversacion con Simi, y se olvida de todo despues de ${HORAS_EXPIRACION} horas sin hablarle)`
      }, { quoted: msg });
    }

    // Detectar menciones especificas (@persona) que WhatsApp ya resuelve como mentionedJid
    let mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Detectar @all / @todos como texto literal -> mencionar a todo el grupo
    const pideTodos = /(^|\s)@(all|todos)(\s|$)/i.test(mensaje);
    const esGrupo = jid.endsWith('@g.us');

    if (pideTodos && esGrupo) {
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

      const historial = obtenerHistorial(clave);
      const historialParaAPI = historial.map(h => ({ role: h.role, text: h.text }));

      let mensajeParaIA = mensaje;
      if (mencionados.length === 1) {
        mensajeParaIA = `(Estas hablando directamente con una persona que fue etiquetada en el chat, dirigete a ella como "tu") ${mensaje}`;
      } else if (mencionados.length > 1) {
        mensajeParaIA = `(Estas hablando directamente con ${mencionados.length} personas que fueron etiquetadas en el chat, dirigete a ellas como "ustedes") ${mensaje}`;
      }

      const respuesta = await chatConPersonalidad(SYSTEM_PROMPT, historialParaAPI, mensajeParaIA);

      const ahora = Date.now();
      historial.push({ role: 'user', text: mensaje, timestamp: ahora });
      historial.push({ role: 'model', text: respuesta, timestamp: ahora });
      while (historial.length > MAX_MENSAJES) historial.shift();

      let etiquetas = '';
      if (mencionados.length) {
        let numerosVisibles = mencionados.map(id => id.split('@')[0]);

        if (esGrupo) {
          try {
            const metadata = await sock.groupMetadata(jid);
            numerosVisibles = mencionados.map(id => {
              const numId = id.split('@')[0];
              const participante = metadata.participants.find(p =>
                (p.id || '').split('@')[0] === numId || (p.lid || '').split('@')[0] === numId
              );
              const numeroReal = (participante?.phoneNumber || '').split('@')[0];
              return numeroReal || numId;
            });
          } catch (err) {
            console.error('No se pudo resolver numeros reales para las menciones:', err);
          }
        }

        etiquetas = numerosVisibles.map(n => `@${n}`).join(' ');
      }
      const textoFinal = etiquetas ? `${etiquetas}\n${respuesta}` : respuesta;

      await sock.sendMessage(jid, { text: textoFinal, mentions: mencionados }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
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

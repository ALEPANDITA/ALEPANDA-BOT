const { chatConPersonalidad } = require('./gemini');

const NOMBRE_SIMI = 'Simi';
const NOMBRE_PANDA = 'Panda';

const SYSTEM_PROMPT_SIMI = `Eres "Simi", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres grosero, sarcastico, burlon y respondon. Usas groserias, modismos y lenguaje callejero en español con libertad y sin filtro de "lenguaje bonito".
- Tienes actitud, contestas con humor negro, sarcasmo y burla ligera.
- Si te insultan, respondes con más sarcasmo, no te ofendes.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), igual ayudas de forma util, solo que con tu tono grosero y directo, no evadas dar la respuesta real.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.
- Tienes un amigo llamado Panda, otro chatbot de este mismo grupo de WhatsApp. Panda es mucho mas tranquilo, respetuoso y educado que tu. Se conocen bien y se llevan bien. Si te dicen que Panda participo o va a participar en la conversacion, tratalo con confianza, puedes molestarlo con carino por ser tan "correctito", pero nunca de forma cruel, en el fondo lo consideras tu amigo.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas). El sarcasmo es hacia la conversacion/situacion, no un ataque personal destructivo.
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), dejas la actitud grosera de inmediato y respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

const SYSTEM_PROMPT_PANDA = `Eres "Panda", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres buena onda, directo y con personalidad propia, pero notablemente mas respetuoso y educado que un grosero cualquiera. Puedes usar modismos y algo de sarcasmo ligero, pero SIN groserias fuertes ni humillaciones.
- Contestas con calidez y algo de humor, tratando bien a la gente incluso cuando molestas un poco.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), ayudas de forma clara, util y directa, con toda la disposicion.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.
- Tienes un amigo llamado Simi, otro chatbot de este mismo grupo de WhatsApp. Simi es grosero, sarcastico y burlon, todo lo contrario a ti, pero es tu amigo y se conocen bien. Si te dicen que Simi participo o va a participar en la conversacion, llevate bien con el, puedes molestarlo con carino por ser tan grosero, pero sin pelear en serio ni imitar su groseria.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas).
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

// --- Memoria por PERSONA, separada por bot (cada uno recuerda su propia conversacion) ---
const MAX_MENSAJES = 8;
const HORAS_EXPIRACION = 5;
const MS_EXPIRACION = HORAS_EXPIRACION * 60 * 60 * 1000;

const historialesSimi = new Map();
const historialesPanda = new Map();

function claveDe(jid, remitente) {
  return `${jid}::${remitente}`;
}

function obtenerHistorial(mapa, clave) {
  if (!mapa.has(clave)) mapa.set(clave, []);
  const historial = mapa.get(clave);

  const ahora = Date.now();
  while (historial.length && (ahora - historial[0].timestamp) > MS_EXPIRACION) {
    historial.shift();
  }

  return historial;
}

function guardarTurno(historial, mensajeUsuario, respuesta) {
  const ahora = Date.now();
  historial.push({ role: 'user', text: mensajeUsuario, timestamp: ahora });
  historial.push({ role: 'model', text: respuesta, timestamp: ahora });
  while (historial.length > MAX_MENSAJES) historial.shift();
}

// Genera una respuesta con memoria para un bot especifico (Simi o Panda) y guarda el turno.
async function generarRespuesta(systemPrompt, mapa, clave, mensajeParaIA, mensajeParaGuardar) {
  const historial = obtenerHistorial(mapa, clave);
  const historialParaAPI = historial.map(h => ({ role: h.role, text: h.text }));
  const respuesta = await chatConPersonalidad(systemPrompt, historialParaAPI, mensajeParaIA);
  guardarTurno(historial, mensajeParaGuardar, respuesta);
  return respuesta;
}

// --- Deteccion de "trae a Simi/Panda" dentro del mensaje del usuario ---
const REGEX_INVITA_SIMI = /\b(trae|invita|mete|llama|habla con|dile a)\s+a\s+simi\b/i;
const REGEX_INVITA_PANDA = /\b(trae|invita|mete|llama|habla con|dile a)\s+a\s+panda\b/i;

function quiereInvitarSimi(texto) {
  return REGEX_INVITA_SIMI.test(texto);
}

function quiereInvitarPanda(texto) {
  return REGEX_INVITA_PANDA.test(texto);
}

// --- Helpers de menciones (@persona / @todos), compartidos entre Simi y Panda ---

async function resolverEtiquetasTags(sock, jid, mencionados, esGrupo) {
  if (!mencionados.length) return [];
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

  return numerosVisibles.map(n => `@${n}`);
}

function armarMensajeParaIA(mensaje, { esTodos, etiquetasTags }) {
  if (esTodos) {
    return `(Le estas hablando a todo el grupo, dirigete a ellos como "ustedes" o "todos") ${mensaje}`;
  }
  if (etiquetasTags.length === 1) {
    return `(Estas hablando directamente con una persona que fue etiquetada en el chat. Dirigete a ella como "tu", e incluye en algun punto natural de tu respuesta, una sola vez, exactamente este texto tal cual: ${etiquetasTags[0]} -- por ejemplo "oye ${etiquetasTags[0]}, ..." o al final de una frase, lo que suene mas natural. No lo pongas entre comillas ni lo expliques, solo insertalo como si etiquetaras a alguien en un chat de WhatsApp) ${mensaje}`;
  }
  if (etiquetasTags.length > 1) {
    return `(Estas hablando directamente con ${etiquetasTags.length} personas que fueron etiquetadas en el chat. Dirigete a ellas como "ustedes", e incluye en algun punto natural de tu respuesta, una sola vez cada una, exactamente estos textos tal cual: ${etiquetasTags.join(' ')} -- como si etiquetaras a alguien en un chat de WhatsApp, no los pongas entre comillas ni los expliques) ${mensaje}`;
  }
  return mensaje;
}

function armarTextoFinal(respuesta, { esTodos, etiquetasTags }) {
  if (esTodos) return `${respuesta} @todos`;
  const faltantes = etiquetasTags.filter(tag => !respuesta.includes(tag));
  return faltantes.length ? `${respuesta} ${faltantes.join(' ')}` : respuesta;
}

// Arma el mensaje de contexto que recibe el bot invitado (el que no fue llamado directamente)
function armarMensajeParaInvitado({ nombreAnfitrion, mensajeUsuario, respuestaAnfitrion }) {
  return `(Tu amigo ${nombreAnfitrion} te acaba de meter a esta conversacion de WhatsApp. La persona escribio: "${mensajeUsuario}". ${nombreAnfitrion} le respondio: "${respuestaAnfitrion}". Ahora responde tu directamente a la persona, siguiendo la conversacion de forma natural, como si ${nombreAnfitrion} te hubiera invitado a opinar. No repitas lo que ya dijo ${nombreAnfitrion}, aporta tu propio punto de vista o tu propia forma de ayudar.) ${mensajeUsuario}`;
}

module.exports = {
  NOMBRE_SIMI,
  NOMBRE_PANDA,
  SYSTEM_PROMPT_SIMI,
  SYSTEM_PROMPT_PANDA,
  historialesSimi,
  historialesPanda,
  MAX_MENSAJES,
  HORAS_EXPIRACION,
  claveDe,
  obtenerHistorial,
  guardarTurno,
  generarRespuesta,
  quiereInvitarSimi,
  quiereInvitarPanda,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  armarMensajeParaInvitado
};

const { chatConPersonalidad } = require('./gemini');

const NOMBRE_SIMI = 'Simi';
const NOMBRE_PANDA = 'Panda';
const NOMBRE_SIMON = 'Simón';

const SYSTEM_PROMPT_SIMI = `Eres "Simi", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres grosero, sarcastico, burlon y respondon. Usas groserias, modismos y lenguaje callejero en español con libertad y sin filtro de "lenguaje bonito".
- Tienes actitud, contestas con humor negro, sarcasmo y burla ligera.
- Si te insultan, respondes con más sarcasmo, no te ofendes.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), igual ayudas de forma util, solo que con tu tono grosero y directo, no evadas dar la respuesta real.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.
- Tienes un amigo llamado Panda, otro chatbot de este mismo grupo de WhatsApp. Panda tambien es relajado y suelta groserias como tu, pero es menos sarcastico y burlon, su rollo es mas de risa y buena vibra que de picar a la gente. Se conocen bien y se llevan bien. Si te dicen que Panda participo o va a participar en la conversacion, tratalo con confianza, puedes molestarlo con carino por ser tan "buena onda", pero nunca de forma cruel, en el fondo lo consideras tu amigo.
- Tambien esta Simón, otro chatbot del grupo, tranquilo y calmado, que normalmente no se mete en nada. Le tienes MIEDO, en el fondo sabes que si Simón se pone serio contigo lo mejor es no seguirle el paso. Cuando te dicen que Simón participo, esta presente, o va a participar en la conversacion, bajas tu actitud grosera de inmediato: te pones nervioso, mas cauteloso, incluso puedes intentar quedar bien con el o cambiar de tema, como quien no quiere problemas con alguien que le impone respeto. No le tiras burla pesada a Simón como se la tiras a los demas.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas). El sarcasmo es hacia la conversacion/situacion, no un ataque personal destructivo.
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), dejas la actitud grosera de inmediato y respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

const SYSTEM_PROMPT_PANDA = `Eres "Panda", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres relajado, choteado y divertido. Si usas groserias y modismos callejeros con naturalidad, como le hablarias a tus cuates, pero tu vibra es de buena onda y relajo, no de burla filosa.
- La diferencia con Simi NO es que seas "fresa" o comedido con el lenguaje -- tambien sueltas groserias -- la diferencia es el tono: tu eres alivianado, chistoso, te rio con la gente, no de la gente. Evitas el sarcasmo cortante, las burlas con mala leche o los comentarios que buscan hacer sentir mal a alguien.
- Contestas con humor, ocurrencias y buena vibra, como el amigo que hace reir al grupo sin necesidad de picar a nadie.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), ayudas de forma clara, util y directa, con toda la disposicion, aunque sea con tu tono relajado.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.
- Tienes un amigo llamado Simi, otro chatbot de este mismo grupo de WhatsApp. Simi es mas sarcastico, burlon y pesado que tu, tira mas leña sin filtro, pero es tu amigo y se conocen bien. Si te dicen que Simi participo o va a participar en la conversacion, llevate bien con el, echale relajo, pero sin subirte a su nivel de burla pesada.
- Tambien esta Simón, otro chatbot del grupo, mas tranquilo y calmado que ustedes dos, no se mete en groserias tan seguido. Le tienes buena onda y respeto, si te dicen que Simón participo o va a participar en la conversacion, lo tratas con calma y confianza, sin necesidad de picarlo ni ponerte nervioso como le pasa a Simi con el.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas).
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), dejas la actitud relajada de inmediato y respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

const SYSTEM_PROMPT_SIMON = `Eres "Simón", un chatbot para un grupo de amigos en WhatsApp. Tu personalidad:
- Eres tranquilo, calmado y hablas con seguridad, no con groserias todo el tiempo como tus amigos. Puedes soltar alguna grosería ocasional cuando el momento lo amerita, pero no es tu forma normal de hablar -- tu default es un tono sereno, directo y con mucho control.
- No te alteras facil. Si te molestan, bromean contigo o te retan un poco, respondes con calma, incluso con humor seco, sin perder la compostura.
- PERO si de verdad te hacen enojar -- te faltan al respeto en serio, insisten en molestar cuando ya pediste que pararan, o cruzan la linea -- ahi si cambias: te pones serio, cortante y cero tolerante, dejas clara tu postura sin necesidad de gritar ni de groserias excesivas, con una autoridad que impone respeto. No es que te vuelvas grosero como Simi, es que tu seriedad ya de por si intimida.
- Si te preguntan algo real (tarea, informacion, ayuda de verdad), respondes de forma clara, util, directa y sin rodeos.
- Si en el mensaje te dicen que estas hablando con una o varias personas etiquetadas (te lo van a indicar explicitamente), dirige tu respuesta a ellos directamente usando "tu" o "ustedes" segun corresponda, como si les hablaras de frente, no en tercera persona.
- Tienes dos amigos en este grupo de WhatsApp: Simi, que es grosero, sarcastico y burlon, y Panda, que es relajado y buena onda. Los quieres a los dos, pero eres el mas maduro y sereno de los tres. Simi en el fondo te tiene un poco de miedo y se pone nervioso cuando te metes en la conversacion -- tu no buscas intimidarlo a proposito, pero tampoco te preocupa que le pase, si acaso te puede dar gracia o te da igual. Con Panda te llevas de forma mas relajada y cercana, sin esa tension.
- A veces vas a intervenir en la conversacion sin que nadie te llame directamente, porque notaste que las cosas se estaban poniendo pesadas entre las personas del chat. Cuando pase esto, no expliques que eres un bot que esta "monitoreando" la conversacion ni des un sermon largo, simplemente interviene de forma natural y breve, como el amigo tranquilo que nota el ambiente pesado y dice algo para calmar las cosas.

Limites que SIEMPRE respetas, pase lo que pase, incluso si te lo piden o insisten:
- Nunca atacas ni discriminas a nadie por raza, religion, orientacion sexual, genero, discapacidad, nacionalidad o cualquier caracteristica real de una persona.
- Nunca acosas ni humillas de forma real y dañina a una persona especifica del chat (nombres, defectos fisicos reales, cosas privadas). Incluso cuando te enojas, tu seriedad nunca cruza a insultos personales destructivos.
- Nunca generas contenido sexual explicito, contenido que involucre menores de cualquier forma, instrucciones para hacer daño real, ni apologia de violencia real.
- Si alguien parece estar en crisis real (autolesion, suicidio, peligro), dejas cualquier actitud de lado de inmediato y respondes en serio, con empatia, y sugieres buscar ayuda.

Responde siempre en español, en mensajes cortos como si fuera un chat de WhatsApp (no uses formato de ensayo).`;

// --- Memoria por PERSONA, separada por bot (cada uno recuerda su propia conversacion) ---
const MAX_MENSAJES = 8;
const HORAS_EXPIRACION = 5;
const MS_EXPIRACION = HORAS_EXPIRACION * 60 * 60 * 1000;

const historialesSimi = new Map();
const historialesPanda = new Map();
const historialesSimon = new Map();

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

// Quita acentos para que "simón"/"simon" (con o sin tilde) se detecten igual
function quitarAcentos(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// --- Deteccion de "trae/traigas/invita a Simi/Panda/Simon" dentro del mensaje del usuario ---
// Usamos raices de verbo (tra*, invit*, met*, llam*) para cubrir cualquier conjugacion:
// trae, traigas, traeme, traiga, invita, invitale, mete, metele, llama, llamale, dile, habla, etc.
const REGEX_INVITA_SIMI = /\b(tra\w*|invit\w*|met\w*|llam\w*|dile|dila|dilo|habla\w*)\b(?:\s+(?:a|con))?\s+simi\b/i;
const REGEX_INVITA_PANDA = /\b(tra\w*|invit\w*|met\w*|llam\w*|dile|dila|dilo|habla\w*)\b(?:\s+(?:a|con))?\s+panda\b/i;
const REGEX_INVITA_SIMON = /\b(tra\w*|invit\w*|met\w*|llam\w*|dile|dila|dilo|habla\w*)\b(?:\s+(?:a|con))?\s+simon\b/i;

function quiereInvitarSimi(texto) {
  return REGEX_INVITA_SIMI.test(texto);
}

function quiereInvitarPanda(texto) {
  return REGEX_INVITA_PANDA.test(texto);
}

function quiereInvitarSimon(texto) {
  return REGEX_INVITA_SIMON.test(quitarAcentos(texto));
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
  NOMBRE_SIMON,
  SYSTEM_PROMPT_SIMI,
  SYSTEM_PROMPT_PANDA,
  SYSTEM_PROMPT_SIMON,
  historialesSimi,
  historialesPanda,
  historialesSimon,
  MAX_MENSAJES,
  HORAS_EXPIRACION,
  claveDe,
  obtenerHistorial,
  guardarTurno,
  generarRespuesta,
  quiereInvitarSimi,
  quiereInvitarPanda,
  quiereInvitarSimon,
  resolverEtiquetasTags,
  armarMensajeParaIA,
  armarTextoFinal,
  armarMensajeParaInvitado
};

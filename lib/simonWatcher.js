// Vigilante de Simon: guarda un buffer reciente de mensajes por grupo y,
// en cada mensaje nuevo, le pregunta a la IA si Simon deberia intervenir
// por su cuenta (sin que nadie lo haya llamado con "trae a simon").

const { generarTexto } = require('./gemini');
const {
  NOMBRE_SIMON,
  SYSTEM_PROMPT_SIMON,
  historialesSimon,
  claveDe,
  generarRespuesta
} = require('./iaAmigos');

const MAX_MENSAJES_BUFFER = 12;
const MS_VIGENCIA_BUFFER = 20 * 60 * 1000; // 20 minutos, luego el contexto viejo ya no cuenta

// jid -> [{ remitente, texto, timestamp }]
const buffers = new Map();

function registrarMensaje(jid, remitente, texto) {
  if (!texto) return;
  if (!buffers.has(jid)) buffers.set(jid, []);
  const buffer = buffers.get(jid);
  const ahora = Date.now();

  buffer.push({ remitente, texto, timestamp: ahora });

  while (buffer.length && ahora - buffer[0].timestamp > MS_VIGENCIA_BUFFER) buffer.shift();
  while (buffer.length > MAX_MENSAJES_BUFFER) buffer.shift();
}

function limpiarBuffer(jid) {
  buffers.delete(jid);
}

function formatearBuffer(jid) {
  const buffer = buffers.get(jid) || [];
  return buffer.map(m => `${m.remitente}: ${m.texto}`).join('\n');
}

const PROMPT_JUEZ = `Eres un moderador silencioso de un grupo de amigos en WhatsApp. Tu unico trabajo es decidir si hace falta que "Simon", un chatbot tranquilo del grupo, intervenga por su cuenta para calmar las cosas, SIN que nadie lo haya llamado.

Responde que SI unicamente cuando haya una pelea real, insultos fuertes y personales entre integrantes del grupo, o una discusion que se esta saliendo de control de verdad.

NO respondas que si por groserias normales de relajo entre amigos, sarcasmo, burlas ligeras o bromas pesadas -- este es un grupo donde ya se hablan con groserias de forma amistosa todo el tiempo, eso es normal y NO amerita intervencion. Solo interviene si de verdad parece que alguien se esta enojando en serio, se estan agrediendo, o hay un conflicto real.

Estos son los ultimos mensajes del chat (el mas reciente al final):
"""
{conversacion}
"""

Responde UNICAMENTE con este JSON, sin texto extra, sin backticks, sin explicacion:
{"intervenir": true, "razon": "breve razon"}
o
{"intervenir": false, "razon": "breve razon"}`;

function extraerJSON(texto) {
  const limpio = String(texto || '').replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(limpio);
  } catch (e) {
    // A veces el modelo mete texto alrededor del JSON, intentamos rescatar solo el bloque {}
    const match = limpio.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (e2) {
      return null;
    }
  }
}

// --- Escalamiento de Simon por grupo: cada vez que interviene sin que se calmen las
// cosas, sube de nivel. Al llegar al nivel de explosion, regaña fuerte y desaparece
// (no vuelve a evaluar nada en ese grupo) durante MS_ENFRIAMIENTO. ---
const NIVEL_EXPLOSION = 4;
const MS_VENTANA_CALMA = 30 * 60 * 1000; // si pasan 30 min sin que haga falta intervenir, se considera pelea nueva y se reinicia el nivel
const MS_ENFRIAMIENTO = 45 * 60 * 1000; // tras explotar, Simon no vuelve a aparecer en ese grupo por 45 min

// jid -> { veces, ultimaIntervencion, enfriadoHasta }
const estadoSimon = new Map();

function obtenerEstadoSimon(jid) {
  if (!estadoSimon.has(jid)) estadoSimon.set(jid, { veces: 0, ultimaIntervencion: 0, enfriadoHasta: 0 });
  return estadoSimon.get(jid);
}

const DESCRIPCION_NIVEL = {
  1: 'Esta es la PRIMERA vez que intervienes por esto: mantente tranquilo y firme, tu version mas calmada.',
  2: 'Esta es la SEGUNDA vez seguida que tienes que intervenir por lo mismo y no te hicieron caso: sube un poco el tono, mas serio y cortante que la vez pasada.',
  3: 'Esta es la TERCERA vez seguida que tienes que intervenir y siguen sin hacerte caso: ya se te esta agotando la paciencia de verdad, suena claramente mas molesto, con alguna groseria de enojo real dirigida a la pelea (no a una persona).',
  4: 'Ya es la CUARTA vez que tienes que intervenir por lo mismo y NADIE te hizo caso: ahora si explotas. Regañalos fuerte, con groserias de enojo real (siempre dirigidas a la pelea o a la actitud del grupo, nunca a una persona en especifico por su nombre), diles claramente que ya te tienen hasta la madre y que te vas a desaparecer un rato porque no vas a seguir de payaso calmando lo mismo una y otra vez. Que se note que te vas de verdad enojado.'
};

// Evalua si Simon debe intervenir en el grupo `jid` y, si aplica, envia su mensaje.
// Se llama en "fire and forget" desde index.js para no bloquear el resto del flujo.
async function evaluarIntervencionSimon(sock, jid) {
  try {
    const estado = obtenerEstadoSimon(jid);
    const ahora = Date.now();

    if (ahora < estado.enfriadoHasta) return; // Simon sigue "desaparecido" tras la ultima explosion

    const conversacion = formatearBuffer(jid);
    if (!conversacion) return;

    const prompt = PROMPT_JUEZ.replace('{conversacion}', conversacion);
    const respuestaJuez = await generarTexto(prompt);
    const decision = extraerJSON(respuestaJuez);

    if (!decision || !decision.intervenir) return;

    // Si ya paso suficiente tiempo tranquilo desde la ultima vez, es una pelea nueva: reinicia el nivel
    if (ahora - estado.ultimaIntervencion > MS_VENTANA_CALMA) {
      estado.veces = 0;
    }

    estado.veces += 1;
    estado.ultimaIntervencion = ahora;

    const esExplosion = estado.veces >= NIVEL_EXPLOSION;
    const nivelParaPrompt = Math.min(estado.veces, NIVEL_EXPLOSION);
    const indicacionNivel = DESCRIPCION_NIVEL[nivelParaPrompt];

    const clave = claveDe(jid, 'auto-vigilancia');
    const mensajeParaSimon = `(Estas viendo la conversacion de este grupo de WhatsApp sin que nadie te haya llamado directamente. Decidiste intervenir por tu cuenta porque la situacion lo amerita. Estos son los ultimos mensajes:\n"""${conversacion}"""\n${indicacionNivel}\nInterviene de forma natural y breve. No te presentes ni expliques que eres un bot analizando mensajes, y no repitas literalmente los mensajes, solo habla como si acabaras de entrar a la conversacion.)`;

    const respuestaSimon = await generarRespuesta(
      SYSTEM_PROMPT_SIMON,
      historialesSimon,
      clave,
      mensajeParaSimon,
      esExplosion ? '(exploto de enojo tras varias intervenciones sin resultado y se fue a desaparecer un rato)' : '(intervino por su cuenta al notar tension en el grupo)'
    );

    await sock.sendMessage(jid, { text: `🧘 *${NOMBRE_SIMON}:* ${respuestaSimon}` });
    limpiarBuffer(jid);

    if (esExplosion) {
      estado.veces = 0;
      estado.enfriadoHasta = ahora + MS_ENFRIAMIENTO;
    }
  } catch (err) {
    // Fallos aqui (sin API key, error temporal de la API, JSON invalido, etc.) se ignoran
    // en silencio a proposito: esto corre en cada mensaje del grupo y no debe spamear el chat
    // con errores por algo que nadie pidio explicitamente.
    console.error('Error evaluando intervencion espontanea de Simon:', err.message || err);
  }
}

module.exports = { registrarMensaje, evaluarIntervencionSimon, limpiarBuffer, formatearBuffer };

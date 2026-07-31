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

// Evalua si Simon debe intervenir en el grupo `jid` y, si aplica, envia su mensaje.
// Se llama en "fire and forget" desde index.js para no bloquear el resto del flujo.
async function evaluarIntervencionSimon(sock, jid) {
  try {
    const conversacion = formatearBuffer(jid);
    if (!conversacion) return;

    const prompt = PROMPT_JUEZ.replace('{conversacion}', conversacion);
    const respuestaJuez = await generarTexto(prompt);
    const decision = extraerJSON(respuestaJuez);

    if (!decision || !decision.intervenir) return;

    const clave = claveDe(jid, 'auto-vigilancia');
    const mensajeParaSimon = `(Estas viendo la conversacion de este grupo de WhatsApp sin que nadie te haya llamado directamente. Decidiste intervenir por tu cuenta porque la situacion lo amerita. Estos son los ultimos mensajes:\n"""${conversacion}"""\nInterviene de forma natural, breve, tranquila pero firme, como quien nota que las cosas se estan poniendo pesadas y quiere calmar el ambiente. No te presentes ni expliques que eres un bot analizando mensajes, y no repitas literalmente los mensajes, solo habla como si acabaras de entrar a la conversacion.)`;

    const respuestaSimon = await generarRespuesta(
      SYSTEM_PROMPT_SIMON,
      historialesSimon,
      clave,
      mensajeParaSimon,
      '(intervino por su cuenta al notar tension en el grupo)'
    );

    await sock.sendMessage(jid, { text: `🧘 *${NOMBRE_SIMON}:* ${respuestaSimon}` });
    limpiarBuffer(jid);
  } catch (err) {
    // Fallos aqui (sin API key, error temporal de la API, JSON invalido, etc.) se ignoran
    // en silencio a proposito: esto corre en cada mensaje del grupo y no debe spamear el chat
    // con errores por algo que nadie pidio explicitamente.
    console.error('Error evaluando intervencion espontanea de Simon:', err.message || err);
  }
}

module.exports = { registrarMensaje, evaluarIntervencionSimon, limpiarBuffer, formatearBuffer };

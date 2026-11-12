// Memoria corta de los mensajes de "ver una vez" que le llegan al bot, para que .ver funcione.
//
// Por que hace falta: cuando alguien RESPONDE a un "ver una vez", WhatsApp no manda adentro de la respuesta la llave del
// archivo (mediaKey), asi que el bot no puede descargarlo desde la cita. En cambio, cuando el mensaje LLEGA al bot si trae
// todo. Aqui se guarda solo la referencia (llave + direccion del archivo, unos KB) en la memoria del proceso; el archivo NO
// se descarga ni se guarda: solo se baja cuando alguien usa .ver. Dura 3 horas, maximo 300 mensajes, y se borra al reiniciar.
const medios = require('./ia-medios');

const MAX_REFERENCIAS = 300;
const TTL_MS = 3 * 60 * 60 * 1000;
const referencias = new Map(); // id del mensaje -> { key, message (contenido real), tipo, ts }

const ENVOLTORIOS_VISTA_UNICA = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];

// Quita envoltorios (temporales, ver una vez...) y dice que hay dentro: { contenido, tipo: 'imagen'|'video'|'audio', nodo, vistaUnica } o null
function analizar(mensaje) {
  let actual = mensaje || {};
  let vistaUnica = false;
  for (let i = 0; i < 6; i++) {
    const envoltorio = ENVOLTORIOS_VISTA_UNICA.find((k) => actual[k] && actual[k].message);
    if (envoltorio) { vistaUnica = true; actual = actual[envoltorio].message; continue; }
    const otro = (actual.ephemeralMessage || actual.documentWithCaptionMessage || {}).message;
    if (otro) { actual = otro; continue; }
    break;
  }
  const par = actual.imageMessage ? ['imagen', actual.imageMessage]
    : actual.videoMessage ? ['video', actual.videoMessage]
    : actual.audioMessage ? ['audio', actual.audioMessage] : null;
  if (!par) return null;
  return { contenido: actual, tipo: par[0], nodo: par[1], vistaUnica: vistaUnica || par[1].viewOnce === true };
}

function limpiar() {
  const ahora = Date.now();
  for (const [id, r] of referencias) if (ahora - r.ts > TTL_MS) referencias.delete(id);
  while (referencias.size > MAX_REFERENCIAS) referencias.delete(referencias.keys().next().value);
}

// Se llama con cada mensaje nuevo (index.js). Solo guarda los de "ver una vez".
function recordar(msg) {
  try {
    if (!msg || !msg.message || !msg.key || !msg.key.id) return false;
    const a = analizar(msg.message);
    if (!a || !a.vistaUnica) return false;
    referencias.set(msg.key.id, { key: msg.key, message: a.contenido, tipo: a.tipo, ts: Date.now() });
    limpiar();
    return true;
  } catch (_) { return false; }
}

function buscar(id) {
  const r = id ? referencias.get(id) : null;
  if (!r) return null;
  if (Date.now() - r.ts > TTL_MS) { referencias.delete(id); return null; }
  return r;
}

module.exports = { recordar, buscar, analizar, TTL_MS, MAX_REFERENCIAS, _vaciar: () => referencias.clear(), _tamano: () => referencias.size };

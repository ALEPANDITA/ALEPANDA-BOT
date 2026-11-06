// lib/iaRespuestas.js
// Hace que Simi, Panda, Simon y Cupido contesten cuando alguien RESPONDE a uno de
// sus mensajes (sin tener que escribir el comando .simi, .panda, etc.).
//
// Como funciona:
//  1) Cuando una IA manda un mensaje, se guarda su id -> de que IA es (envolverSock).
//  2) Cuando llega un mensaje que responde a un id guardado, se le pasa a esa IA
//     con la memoria de esa persona (la misma que usan los comandos).
// Los ids se guardan en ia-respuestas.json (2 dias) para que siga funcionando
// aunque se reinicie el bot.

const fs = require('fs');
const path = require('path');
const iaAmigos = require('./iaAmigos');

const ARCHIVO = path.join(__dirname, '..', 'ia-respuestas.json');
const TTL_MS = 48 * 60 * 60 * 1000;   // cuanto tiempo se puede seguir respondiendo a un mensaje
const MAX_REGISTROS = 1500;
const PAUSA_USUARIO_MS = 3000;        // minimo entre respuestas a la misma persona
const MAX_POR_MINUTO_CHAT = 12;       // tope de respuestas por chat por minuto
const MAX_LARGO_TEXTO = 1000;

const IAS = {
  simi: { nombre: iaAmigos.NOMBRE_SIMI, prompt: iaAmigos.SYSTEM_PROMPT_SIMI, historial: iaAmigos.historialesSimi, prefijo: '' },
  panda: { nombre: iaAmigos.NOMBRE_PANDA, prompt: iaAmigos.SYSTEM_PROMPT_PANDA, historial: iaAmigos.historialesPanda, prefijo: '' },
  simon: { nombre: iaAmigos.NOMBRE_SIMON, prompt: iaAmigos.SYSTEM_PROMPT_SIMON, historial: iaAmigos.historialesSimon, prefijo: '' },
  cupido: { nombre: iaAmigos.NOMBRE_CUPIDO, prompt: iaAmigos.SYSTEM_PROMPT_CUPIDO, historial: iaAmigos.historialesCupido, prefijo: '💘 ' }
};

// ---------- Registro id -> IA ----------
let registro = new Map();
let guardadoPendiente = null;

function cargar() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
    const ahora = Date.now();
    for (const [id, r] of Object.entries(datos)) {
      if (r && IAS[r.ia] && typeof r.jid === 'string' && ahora - r.t < TTL_MS) registro.set(id, r);
    }
  } catch (_) {}
}

function guardarConRetraso() {
  if (guardadoPendiente) return;
  guardadoPendiente = setTimeout(() => {
    guardadoPendiente = null;
    try {
      const ahora = Date.now();
      for (const [id, r] of registro) if (ahora - r.t > TTL_MS) registro.delete(id);
      while (registro.size > MAX_REGISTROS) registro.delete(registro.keys().next().value);
      const tmp = ARCHIVO + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(registro)));
      fs.renameSync(tmp, ARCHIVO);
    } catch (err) {
      console.error('[iaRespuestas] no se pudo guardar el registro:', err.message);
    }
  }, 2000);
  if (guardadoPendiente.unref) guardadoPendiente.unref();
}

function registrar(idMensaje, ia, jid) {
  if (!idMensaje || !IAS[ia]) return;
  registro.set(idMensaje, { ia, jid, t: Date.now() });
  guardarConRetraso();
}

// Los mensajes de un amigo invitado o de Simon (modo automatico) llevan su nombre
// al inicio, asi sabemos de quien son aunque los mande otro comando.
const REGEX_PREFIJO = /^\s*(?:😈|🐼|🧘|💘)\s*\*?\s*(Simi|Panda|Sim[oó]n|Cupido)\b/i;

function iaPorPrefijo(texto) {
  const m = REGEX_PREFIJO.exec(String(texto || ''));
  if (!m) return null;
  const n = m[1].toLowerCase().replace('ó', 'o');
  return IAS[n] ? n : null;
}

// Devuelve un "sock" que funciona igual, pero que anota los mensajes de texto que manda.
function envolverSock(sock, iaPorDefecto) {
  return new Proxy(sock, {
    get(destino, propiedad) {
      if (propiedad === 'sendMessage') {
        return async (...args) => {
          const resultado = await destino.sendMessage(...args);
          try {
            const contenido = args[1] || {};
            if (typeof contenido.text === 'string' && resultado?.key?.id) {
              registrar(resultado.key.id, iaPorPrefijo(contenido.text) || iaPorDefecto, args[0]);
            }
          } catch (_) {}
          return resultado;
        };
      }
      const valor = Reflect.get(destino, propiedad, destino);
      return typeof valor === 'function' ? valor.bind(destino) : valor;
    }
  });
}

// Para el despachador de comandos: solo envuelve los comandos de estas 4 IAs.
function envolverSockSiEsIA(sock, comando) {
  const nombre = comando && comando.name;
  return IAS[nombre] ? envolverSock(sock, nombre) : sock;
}

// ---------- Responder cuando citan un mensaje de una IA ----------
const ultimaRespuestaPersona = new Map(); // chat::persona -> cuando
const respuestasPorChat = new Map();      // chat -> [timestamps]

function textoCitado(ctx) {
  const q = ctx && ctx.quotedMessage;
  return String((q && (q.conversation || (q.extendedTextMessage && q.extendedTextMessage.text))) || '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function permitido(jid, clavePersona) {
  const ahora = Date.now();
  if (ahora - (ultimaRespuestaPersona.get(clavePersona) || 0) < PAUSA_USUARIO_MS) return false;
  const recientes = (respuestasPorChat.get(jid) || []).filter((t) => ahora - t < 60000);
  if (recientes.length >= MAX_POR_MINUTO_CHAT) { respuestasPorChat.set(jid, recientes); return false; }
  recientes.push(ahora);
  respuestasPorChat.set(jid, recientes);
  ultimaRespuestaPersona.set(clavePersona, ahora);
  if (ultimaRespuestaPersona.size > 2000) ultimaRespuestaPersona.delete(ultimaRespuestaPersona.keys().next().value);
  return true;
}

async function responder(sock, jid, msg, texto, ia, ctx) {
  const config = IAS[ia];
  const remitente = msg.key.participant || msg.key.remoteJid;
  const clave = iaAmigos.claveDe(jid, remitente);
  const citado = textoCitado(ctx);

  try { await sock.sendPresenceUpdate('composing', jid); } catch (_) {}

  const mensajeParaIA = citado
    ? `(La persona te esta respondiendo directamente a este mensaje tuyo: "${citado}". Contestale siguiendo esa conversacion, sin repetir lo que ya dijiste.) ${texto}`
    : texto;

  try {
    const respuesta = await iaAmigos.generarRespuesta(config.prompt, config.historial, clave, mensajeParaIA, texto);
    await envolverSock(sock, ia).sendMessage(jid, { text: config.prefijo + respuesta }, { quoted: msg });
  } catch (err) {
    console.error(`[iaRespuestas] ${config.nombre} no pudo contestar:`, err.message);
    const motivo = err.code === 'NO_API_KEY' ? 'no hay API key de IA configurada' : err.message;
    await sock.sendMessage(jid, { text: `⚠️ ${config.nombre} no pudo contestar: ${motivo}` }, { quoted: msg });
  } finally {
    try { await sock.sendPresenceUpdate('paused', jid); } catch (_) {}
  }
}

// Devuelve true si el mensaje era una respuesta a una IA (y ya se encargo), false si no.
function manejarRespuestaCitada({ sock, jid, msg, texto }) {
  const ctx = msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo;
  const idCitado = ctx && ctx.stanzaId;
  if (!idCitado) return false;

  const reg = registro.get(idCitado);
  if (!reg || reg.jid !== jid || Date.now() - reg.t > TTL_MS) return false;

  const limpio = String(texto || '').trim().slice(0, MAX_LARGO_TEXTO);
  if (!limpio) return false;

  const remitente = msg.key.participant || msg.key.remoteJid;
  if (!permitido(jid, `${jid}::${remitente}`)) return true; // demasiado seguido: se ignora sin contestar

  responder(sock, jid, msg, limpio, reg.ia, ctx).catch((err) => console.error('[iaRespuestas]', err));
  return true;
}

cargar();

module.exports = { envolverSock, envolverSockSiEsIA, manejarRespuestaCitada, registrar, iaPorPrefijo };

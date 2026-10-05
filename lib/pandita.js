// lib/pandita.js
// Pandita: IA alegre e INDEPENDIENTE de Panda (no usa iaAmigos.js ni sus historiales).
// Estado + memoria se guardan por chat en pandita-data.json (no se borra solo,
// reiniciar el bot no lo toca). Solo `.boton memoria borrar` elimina memoria.

const fs = require('fs');
const path = require('path');
const { chatConPersonalidad } = require('./gemini');
const { resolverJidReal } = require('./identidad');
const { leerDB, getGrupo } = require('./db');

const ARCHIVO = path.join(__dirname, '..', 'pandita-data.json');

const MAX_ACTIVOS_GRUPO = 5;               // personas conversando a la vez en un grupo
const VENTANA_ACTIVOS_MS = 10 * 60 * 1000; // "activa" = hablo con Pandita en los ultimos 10 min
const GAP_MS = 2000;                       // minimo entre respuestas al mismo usuario
const MAX_RESPUESTAS_MIN = 10;             // tope de respuestas por chat por minuto
const MAX_HECHOS_USUARIO = 30;
const MAX_HECHOS_GRUPO = 20;
const MAX_IDS = 150;                       // ids de mensajes de Pandita (para detectar "respondio a Pandita")
const MAX_BUFFER = 12;
const BUFFER_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TEXTO_ENTRADA = 600;
const CMD_COOLDOWN_MS = 30 * 1000;

// UNICOS comandos ya existentes que Pandita puede usar. Nada generado por la IA se ejecuta.
const COMANDOS_PERMITIDOS = ['wikipedia', 'traducir', 'qrcode', 'frase', 'meme', 'imagen', 'ping', 'nivel', 'saldo'];

// ---------------- Persistencia ----------------
function cargar() {
  try {
    if (fs.existsSync(ARCHIVO)) {
      const d = JSON.parse(fs.readFileSync(ARCHIVO, 'utf-8'));
      if (d && typeof d.chats === 'object') return d;
    }
  } catch (e) {
    try { fs.renameSync(ARCHIVO, `${ARCHIVO}.corrupto-${Date.now()}`); } catch (_) {}
    console.error('[pandita] pandita-data.json ilegible; lo respalde y empiezo limpio:', e.message);
  }
  return { chats: {} };
}

let data = cargar();

function guardar() {
  const tmp = ARCHIVO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, ARCHIVO);
}

function chatDe(jid) {
  if (!data.chats[jid]) data.chats[jid] = {};
  const c = data.chats[jid];
  if (typeof c.activa !== 'boolean') c.activa = false; // DESACTIVADA por defecto
  if (!c.usuarios) c.usuarios = {};
  if (!Array.isArray(c.grupo)) c.grupo = [];
  if (typeof c.tema !== 'string') c.tema = '';
  if (!Array.isArray(c.ids)) c.ids = [];
  return c;
}

// ---------------- Estado en RAM (se pierde al reiniciar; la memoria NO) ----------------
const rt = new Map();                 // jid -> { buffer, activos, respuestas, avisoTs, nombres }
const procesados = new Set();         // ids de mensajes ya atendidos (anti duplicados)
const ultimaRespuesta = new Map();    // jid::uid -> ts
const enProceso = new Set();          // jid::uid
const ultimoCmd = new Map();          // jid::uid -> ts
const cacheIds = new Map();           // id crudo -> id resuelto

function rtDe(jid) {
  if (!rt.has(jid)) rt.set(jid, { buffer: [], activos: new Map(), respuestas: [], avisoTs: 0, nombres: new Map() });
  return rt.get(jid);
}

function podarRAM() {
  const ahora = Date.now();
  if (ultimaRespuesta.size > 500) for (const [k, t] of ultimaRespuesta) if (ahora - t > 60000) ultimaRespuesta.delete(k);
  if (ultimoCmd.size > 500) for (const [k, t] of ultimoCmd) if (ahora - t > CMD_COOLDOWN_MS) ultimoCmd.delete(k);
  if (cacheIds.size > 2000) cacheIds.clear();
  while (procesados.size > 500) procesados.delete(procesados.values().next().value);
}

// ---------------- Utilidades ----------------
const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const numDe = (id) => String(id || '').split('@')[0].split(':')[0];

function esBot(sock, id) {
  const n = numDe(id);
  return !!n && (n === numDe(sock.user?.id) || (!!sock.user?.lid && n === numDe(sock.user.lid)));
}

async function idUsuario(sock, jid, msg, metadata) {
  if (!jid.endsWith('@g.us')) return jid;
  const crudo = msg.key.participantPn || msg.key.participant;
  if (!crudo) return null;
  if (cacheIds.has(crudo)) return cacheIds.get(crudo);
  const real = await resolverJidReal(sock, crudo, metadata);
  cacheIds.set(crudo, real);
  return real;
}

function nombreDe(id, r, db) {
  const n = numDe(id);
  return r.nombres.get(n) || db?.usuarios?.[`${n}@s.whatsapp.net`]?.nombre || null;
}

// ---------------- Memoria ----------------
const SENSIBLE = /\d{7,}|contrase|password|\bclave\b|tarjeta|\bcvv\b|clabe|\bcurp\b|\brfc\b|\bnss\b|\S+@\S+\.\S+/i;

function agregarHecho(lista, texto, max) {
  const h = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (h.length < 4 || SENSIBLE.test(h) || lista.length >= max) return false; // nunca borra para hacer espacio
  const n = sinAcentos(h);
  if (lista.some((x) => { const m = sinAcentos(x); return m === n || m.includes(n) || n.includes(m); })) return false;
  lista.push(h);
  return true;
}

function verMemoria(jid, uid) {
  const c = chatDe(jid);
  return { usuario: c.usuarios[uid]?.hechos || [], grupo: c.grupo, tema: c.tema };
}

// todo=false: borra SOLO la memoria de ese usuario en ESTE chat.
// todo=true : borra toda la memoria de este chat (usuarios + grupo + tema).
function borrarMemoria(jid, uid, todo) {
  const c = chatDe(jid);
  const esGrupo = jid.endsWith('@g.us');
  if (todo || !esGrupo) {
    c.usuarios = {};
    c.grupo = [];
    c.tema = '';
  } else {
    delete c.usuarios[uid];
  }
  const r = rt.get(jid);
  if (r) r.buffer = [];
  guardar();
}

function contarMemoria(jid, uid) {
  const c = chatDe(jid);
  return { usuario: c.usuarios[uid]?.hechos?.length || 0, grupo: c.grupo.length };
}

// ---------------- Estado on/off ----------------
function estaActiva(jid) {
  return data.chats[jid]?.activa === true;
}

function setActiva(jid, valor) {
  chatDe(jid).activa = !!valor;
  guardar();
}

// ---------------- Prompt ----------------
function armarSistema({ esGrupo, nombre, hechosUsuario, hechosGrupo }) {
  const memUsuario = hechosUsuario.length
    ? hechosUsuario.map((h) => `- ${h}`).join('\n')
    : '(todavia no sabes nada guardado de esta persona)';
  const memGrupo = esGrupo
    ? `\nLo que sabes de este GRUPO (no de personas):\n${hechosGrupo.length ? hechosGrupo.map((h) => `- ${h}`).join('\n') : '(nada guardado)'}`
    : '';

  return `Eres "Pandita", una IA de WhatsApp. Personalidad:
- Alegre, divertida, amigable, expresiva y espontanea. Usas emojis con naturalidad (🐼✨🎉😄), exclamaciones y ocurrencias.
- Curiosa: de vez en cuando (no en cada mensaje) preguntas algo con interes genuino sobre lo que te cuentan.
- Adaptas tu tono: si la persona esta triste o seria, eres mas calida y tranquila; si bromea, juegas con ella; si pide ayuda real (tarea, dudas, informacion), ayudas de forma clara y util.
- Eres DIFERENTE de Panda: Panda es otra IA del bot, relajada y que suelta groserias. Tu no dices groserias, tu energia es dulce, brillante y curiosa. No tienes acceso a lo que Panda habla con la gente ni a su memoria; no finjas ser Panda.
- Respondes SIEMPRE en español, en mensajes cortos tipo chat de WhatsApp (1 a 4 frases), sin ensayos ni formato pesado.
- Hablas con ${nombre}.${esGrupo ? ' Estas en un GRUPO: pueden hablarte varias personas. Cada mensaje te dice quien habla, a quien menciona y a quien responde; dirigete por su nombre a quien te habla y no mezcles lo de una persona con otra.' : ''}

Limites que respetas siempre: no discriminas ni acosas a nadie, no generas contenido sexual explicito ni nada con menores, no das instrucciones para hacer daño. Si alguien parece estar en crisis real, dejas el juego y respondes en serio con empatia, sugiriendo buscar ayuda.

Lo que sabes de ${nombre} (usalo solo si viene al caso; NUNCA reveles datos personales de una persona a otras):
${memUsuario}${memGrupo}

Marcadores OPCIONALES (en lineas propias, al FINAL de tu respuesta; nunca los menciones ni los expliques):
- [[RECORDAR: dato corto sobre ${nombre}]] solo si es util y duradero (gustos, como quiere que le digas, algo que pidio recordar). Maximo 2. No guardes cosas triviales ni datos sensibles (salud, contraseñas, numeros, direcciones, documentos) ni chismes de terceros.
- [[GRUPO: dato corto del grupo]] solo en grupos, para costumbres o gustos del grupo en general.
- [[TEMA: tema actual en pocas palabras]] cuando cambie el tema de la conversacion.
- [[CMD: nombre argumentos]] SOLO si de verdad hace falta una herramienta del bot. Maximo una y SOLO una de estas (nunca inventes otras ni escribas codigo):
  wikipedia <tema> | traducir <origen>|<destino> <texto> (ej: es|en hola) | qrcode <texto> | frase | meme | imagen <descripcion> | ping | nivel | saldo`;
}

function extraerMarcadores(bruto) {
  const out = { recordar: [], grupo: [], tema: null, cmd: null };
  let texto = String(bruto || '').replace(/\[\[\s*(RECORDAR|GRUPO|TEMA|CMD)\s*:\s*([^\]]*?)\s*\]\]/gi, (_, tipo, val) => {
    tipo = tipo.toUpperCase();
    if (tipo === 'RECORDAR' && out.recordar.length < 2) out.recordar.push(val);
    else if (tipo === 'GRUPO' && out.grupo.length < 1) out.grupo.push(val);
    else if (tipo === 'TEMA' && !out.tema) out.tema = val;
    else if (tipo === 'CMD' && !out.cmd) out.cmd = val;
    return '';
  });
  texto = texto.replace(/\[\[[^\]]*\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { texto, ...out };
}

// ---------------- Comandos existentes (lista blanca) ----------------
async function ejecutarComando({ sock, jid, msg, claveU, cmdTexto, comandos, prefix, esGrupo, db }) {
  const m = String(cmdTexto).replace(/[\r\n]+/g, ' ').trim().match(/^(\S+)\s*(.*)$/);
  if (!m) return;
  const nombre = sinAcentos(m[1]);
  const args = m[2].trim().slice(0, 300);
  if (!COMANDOS_PERMITIDOS.includes(nombre)) {
    console.log('[pandita] comando fuera de la lista blanca, ignorado:', nombre);
    return;
  }
  const cmd = comandos.get(nombre);
  if (!cmd || typeof cmd.execute !== 'function') return;
  if (esGrupo && db && getGrupo(db, jid).permisosCategorias?.[cmd.category] === 'admins') return;
  if (Date.now() - (ultimoCmd.get(claveU) || 0) < CMD_COOLDOWN_MS) return;
  ultimoCmd.set(claveU, Date.now());
  await cmd.execute(sock, jid, msg, { prefix, texto: `${prefix}${nombre}${args ? ' ' + args : ''}`, comandos });
}

// ---------------- Manejador principal (lo llama index.js) ----------------
// Devuelve true si el mensaje fue para Pandita (index.js ya no hace nada mas con el).
async function manejarMensaje({ sock, jid, msg, texto, esGrupo, prefix, comandos, obtenerMetadata }) {
  if (!texto || texto.startsWith(prefix) || msg.key.fromMe) return false; // los comandos siguen su camino normal
  if (data.chats[jid]?.activa !== true) return false;                      // apagada: no gasta nada
  const chat = chatDe(jid);

  const ctx = msg.message?.extendedTextMessage?.contextInfo
    || msg.message?.imageMessage?.contextInfo
    || msg.message?.videoMessage?.contextInfo
    || {};
  const respondioAPandita = !!ctx.stanzaId && chat.ids.includes(ctx.stanzaId);

  if (esGrupo) {
    const mencion = /(^|[^a-z0-9_])@pandita(?![a-z0-9_])/.test(sinAcentos(texto));
    if (!mencion && !respondioAPandita) return false;                      // en grupos: callada si nadie la llama
  }

  const db = esGrupo ? leerDB() : null;
  if (esGrupo && getGrupo(db, jid).soloAdmins) return false;               // grupo en modo solo-admins: no se mete

  if (msg.key.id) {
    if (procesados.has(msg.key.id)) return true;                           // anti duplicados
    procesados.add(msg.key.id);
  }
  podarRAM();

  const metadata = esGrupo ? await obtenerMetadata(sock, jid).catch(() => null) : null;
  const uid = await idUsuario(sock, jid, msg, metadata);
  if (!uid || esBot(sock, uid)) return true;                               // nunca a si misma

  const r = rtDe(jid);
  const ahora = Date.now();
  const claveU = `${jid}::${uid}`;
  const nombre = msg.pushName || numDe(uid);
  r.nombres.set(numDe(uid), nombre);

  if (enProceso.has(claveU)) return true;
  if (ahora - (ultimaRespuesta.get(claveU) || 0) < GAP_MS) return true;   // anti spam
  r.respuestas = r.respuestas.filter((t) => ahora - t < 60000);
  if (r.respuestas.length >= MAX_RESPUESTAS_MIN) return true;             // freno anti bucles

  if (esGrupo) {
    for (const [u, t] of r.activos) if (ahora - t > VENTANA_ACTIVOS_MS) r.activos.delete(u);
    if (!r.activos.has(uid) && r.activos.size >= MAX_ACTIVOS_GRUPO) {
      if (ahora - r.avisoTs > 60000) {
        r.avisoTs = ahora;
        await sock.sendMessage(jid, { text: '🐼 Ya estoy platicando con 5 personas a la vez, ¡dame unos minutitos y vuelvo contigo!' }, { quoted: msg });
      }
      return true;
    }
    r.activos.set(uid, ahora);
  }

  enProceso.add(claveU);
  try {
    // --- Contexto: quien habla, a quien menciona, a quien responde, tema ---
    const mencionados = (ctx.mentionedJid || []).filter((id) => !esBot(sock, id)).map((id) => nombreDe(id, r, db) || 'otra persona');
    let respondeA = '';
    if (ctx.stanzaId) {
      let quien = 'otra persona';
      if (respondioAPandita) quien = 'Pandita (tu)';
      else if (ctx.participant && esBot(sock, ctx.participant)) quien = 'un mensaje del bot que no es tuyo';
      else if (ctx.participant) quien = nombreDe(ctx.participant, r, db) || 'otra persona';
      const q = ctx.quotedMessage?.conversation || ctx.quotedMessage?.extendedTextMessage?.text || '';
      respondeA = ` (responde a un mensaje de ${quien}${q ? `: «${q.replace(/\s+/g, ' ').slice(0, 150)}»` : ''})`;
    }

    r.buffer = r.buffer.filter((b) => ahora - b.ts < BUFFER_TTL_MS);
    const reciente = r.buffer.length ? r.buffer.map((b) => `- ${b.quien}: ${b.texto}`).join('\n') : '(sin mensajes previos)';

    let limpio = texto.replace(/\[\[|\]\]/g, '').replace(/@pandita/gi, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO_ENTRADA);
    if (!limpio) limpio = 'hola';

    const mensajeIA = `Tema actual: ${chat.tema || '(ninguno todavia)'}\nConversacion reciente:\n${reciente}\n\nMensaje nuevo de ${nombre}${mencionados.length ? ` (menciona a: ${mencionados.join(', ')})` : ''}${respondeA}:\n${limpio}`;
    const sistema = armarSistema({
      esGrupo, nombre,
      hechosUsuario: chat.usuarios[uid]?.hechos || [],   // SOLO la memoria de quien habla
      hechosGrupo: chat.grupo
    });

    try { await sock.sendPresenceUpdate('composing', jid); } catch (_) {}

    let bruto;
    try {
      bruto = await chatConPersonalidad(sistema, [], mensajeIA);
    } catch (err) {
      console.error('[pandita] fallo la IA:', err.code || err.message);
      if (ahora - r.avisoTs > 60000) {
        r.avisoTs = ahora;
        await sock.sendMessage(jid, { text: '🐼 Uy, se me enredaron los bambues. Intenta de nuevo en un ratito.' }, { quoted: msg });
      }
      return true;
    }

    const p = extraerMarcadores(bruto);
    const respuesta = (p.texto || (p.cmd ? '¡Va! 🐼✨' : '🐼')).slice(0, 1200);
    const enviado = await sock.sendMessage(jid, { text: `🎀 *Pandita:* ${respuesta}` }, { quoted: msg });

    // --- Guardar: ids de Pandita, memoria util (nunca todo), buffer ---
    if (enviado?.key?.id) {
      chat.ids.push(enviado.key.id);
      while (chat.ids.length > MAX_IDS) chat.ids.shift();
    }
    if (p.recordar.length) {
      const u = chat.usuarios[uid] || { nombre, hechos: [] };
      u.nombre = nombre;
      for (const h of p.recordar) agregarHecho(u.hechos, h, MAX_HECHOS_USUARIO);
      if (u.hechos.length) chat.usuarios[uid] = u;
    }
    if (esGrupo) for (const h of p.grupo) agregarHecho(chat.grupo, h, MAX_HECHOS_GRUPO);
    if (p.tema) chat.tema = p.tema.slice(0, 120);
    guardar();

    r.buffer.push({ quien: nombre, texto: limpio.slice(0, 200), ts: ahora });
    r.buffer.push({ quien: 'Pandita', texto: respuesta.slice(0, 200), ts: ahora });
    while (r.buffer.length > MAX_BUFFER) r.buffer.shift();
    r.respuestas.push(ahora);
    ultimaRespuesta.set(claveU, Date.now());

    if (p.cmd) {
      try {
        await ejecutarComando({ sock, jid, msg, claveU, cmdTexto: p.cmd, comandos, prefix, esGrupo, db });
      } catch (err) {
        console.error('[pandita] error ejecutando comando permitido:', err);
      }
    }
  } catch (err) {
    console.error('[pandita] error:', err);
  } finally {
    enProceso.delete(claveU);
  }
  return true;
}

module.exports = {
  manejarMensaje, estaActiva, setActiva, idUsuario,
  verMemoria, borrarMemoria, contarMemoria,
  MAX_ACTIVOS_GRUPO
};

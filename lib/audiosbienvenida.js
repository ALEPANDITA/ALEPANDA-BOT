// lib/audiosbienvenida.js
// Audios extra para la bienvenida y la despedida de cada grupo.
// Se pueden guardar varios por grupo (hasta MAX_AUDIOS) y el bot manda uno al
// azar (o todos en orden) despues del texto/imagen cuando alguien entra o sale.
//
// Todo se guarda en assets/<bienvenida|despedida>/audios/<id-del-grupo>/ con un
// index.json propio (no toca database.json, asi no hay choques al guardar).

const fs = require('fs');
const path = require('path');

const MAX_AUDIOS = 30;            // audios guardados por grupo y tipo
const MAX_SEGUNDOS = 40;          // duracion maxima de cada audio
const MAX_BYTES = 5 * 1024 * 1024;
const PAUSA_MS = 8000;            // si entran muchos de golpe, no manda audio mas seguido que esto
const MAX_EN_MODO_TODOS = 5;      // en modo "todos" nunca manda mas de este numero de golpe

const ultimoIndice = new Map();   // tipo|grupo -> ultimo audio mandado (para no repetirlo seguido)
const ultimoEnvio = new Map();    // tipo|grupo -> cuando se mando el ultimo

function carpeta(tipo, jid) {
  const id = String(jid).replace('@g.us', '').replace(/[^\w-]/g, '_');
  return path.join(__dirname, '..', 'assets', tipo === 'welcome' ? 'bienvenida' : 'despedida', 'audios', id);
}

function leerIndice(tipo, jid) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(carpeta(tipo, jid), 'index.json'), 'utf8'));
    return {
      modo: d.modo === 'todos' ? 'todos' : 'aleatorio',
      audios: Array.isArray(d.audios) ? d.audios.filter((a) => a && typeof a.archivo === 'string' && /^[\w.-]+$/.test(a.archivo)) : []
    };
  } catch (_) {
    return { modo: 'aleatorio', audios: [] };
  }
}

function guardarIndice(tipo, jid, indice) {
  const dir = carpeta(tipo, jid);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, 'index.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(indice, null, 2));
  fs.renameSync(tmp, path.join(dir, 'index.json'));
}

function rutaAudio(tipo, jid, audio) {
  return path.join(carpeta(tipo, jid), audio.archivo);
}

function agregarAudio(tipo, jid, buffer, { mimetype, ptt, segundos }) {
  const indice = leerIndice(tipo, jid);
  if (indice.audios.length >= MAX_AUDIOS) {
    return { ok: false, error: `Ya hay ${MAX_AUDIOS} audios guardados, que es el maximo. Borra alguno con borrar <numero>.` };
  }
  if (segundos && segundos > MAX_SEGUNDOS) {
    return { ok: false, error: `El audio dura ${segundos}s y el maximo es ${MAX_SEGUNDOS}s.` };
  }
  if (!buffer || !buffer.length || buffer.length > MAX_BYTES) {
    return { ok: false, error: `El audio pesa demasiado (maximo ${MAX_BYTES / 1024 / 1024} MB).` };
  }

  const archivo = `a${Date.now()}_${Math.random().toString(36).slice(2, 6)}.bin`;
  fs.mkdirSync(carpeta(tipo, jid), { recursive: true });
  fs.writeFileSync(path.join(carpeta(tipo, jid), archivo), buffer);

  indice.audios.push({
    archivo,
    mimetype: String(mimetype || 'audio/mp4').slice(0, 60),
    ptt: !!ptt,
    segundos: Number(segundos) || 0,
    agregado: Date.now()
  });
  guardarIndice(tipo, jid, indice);
  return { ok: true, total: indice.audios.length };
}

function borrarAudio(tipo, jid, numero) {
  const indice = leerIndice(tipo, jid);
  const i = numero - 1;
  if (!Number.isInteger(i) || i < 0 || i >= indice.audios.length) return false;
  const [quitado] = indice.audios.splice(i, 1);
  try { fs.unlinkSync(rutaAudio(tipo, jid, quitado)); } catch (_) {}
  guardarIndice(tipo, jid, indice);
  return true;
}

function borrarTodos(tipo, jid) {
  const indice = leerIndice(tipo, jid);
  for (const a of indice.audios) {
    try { fs.unlinkSync(rutaAudio(tipo, jid, a)); } catch (_) {}
  }
  const cantidad = indice.audios.length;
  indice.audios = [];
  guardarIndice(tipo, jid, indice);
  return cantidad;
}

function cambiarModo(tipo, jid, modo) {
  const indice = leerIndice(tipo, jid);
  indice.modo = modo === 'todos' ? 'todos' : 'aleatorio';
  guardarIndice(tipo, jid, indice);
  return indice.modo;
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Manda el/los audios guardados. Nunca lanza error (si algo falla, solo lo registra).
// Devuelve cuantos audios mando.
async function enviarAudios(sock, jid, tipo, { forzar = false } = {}) {
  try {
    const indice = leerIndice(tipo, jid);
    const validos = indice.audios.filter((a) => fs.existsSync(rutaAudio(tipo, jid, a)));
    if (!validos.length) return 0;

    const clave = `${tipo}|${jid}`;
    if (!forzar && Date.now() - (ultimoEnvio.get(clave) || 0) < PAUSA_MS) return 0;
    ultimoEnvio.set(clave, Date.now());

    let elegidos;
    if (indice.modo === 'todos') {
      elegidos = validos.slice(0, MAX_EN_MODO_TODOS);
    } else {
      let posibles = validos;
      const anterior = ultimoIndice.get(clave);
      if (validos.length > 1 && anterior !== undefined) {
        posibles = validos.filter((a) => a.archivo !== anterior);
      }
      const elegido = posibles[Math.floor(Math.random() * posibles.length)];
      ultimoIndice.set(clave, elegido.archivo);
      elegidos = [elegido];
    }

    let enviados = 0;
    for (const audio of elegidos) {
      try {
        await sock.sendMessage(jid, {
          audio: fs.readFileSync(rutaAudio(tipo, jid, audio)),
          mimetype: audio.mimetype || 'audio/mp4',
          ptt: !!audio.ptt
        });
        enviados++;
      } catch (err) {
        console.error('[audiosbienvenida] no se pudo mandar un audio:', err.message);
      }
      if (elegidos.length > 1) await esperar(1000);
    }
    return enviados;
  } catch (err) {
    console.error('[audiosbienvenida]', err.message);
    return 0;
  }
}

module.exports = {
  MAX_AUDIOS, MAX_SEGUNDOS,
  leerIndice, agregarAudio, borrarAudio, borrarTodos, cambiarModo, enviarAudios
};

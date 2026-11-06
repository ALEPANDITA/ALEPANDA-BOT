// lib/crearcmd-prueba.js
//
// Prueba si un comando que YA existe funciona, antes de tocarlo.
//
//  - Comandos "de reaccion/imagen" (categorias anime, animeimg, interaction, nsfw, nsfw2 y que no
//    escriben en la base de datos ni ejecutan shell): se EJECUTAN de verdad con un socket falso que
//    solo anota lo que mandarian. Si mandan un gif/imagen/video/audio -> funcionan.
//  - El resto: se prueban las URLs que llaman (sin ejecutarlos, para no tener efectos secundarios).
//  - Si no hay forma segura de probarlos -> "sin_prueba".
//
// Resultado por comando: { estado: 'ok' | 'roto' | 'sin_prueba', detalle, ruta }

const fs = require('fs');
const { diagnosticarComando } = require('./diagnostico-red');

const CATEGORIAS_SEGURAS = new Set(['anime', 'animeimg', 'interaction', 'nsfw', 'nsfw2']);
const RIESGOSO = /guardarDB|leerDB|getUsuario|writeFileSync|appendFileSync|child_process|\bexec\(|\bexecSync\(|\bspawn\(|unlinkSync|rmSync|process\.exit/;
const SEÑAL_DE_ERROR = /error|no se pudo|intenta de nuevo|fall[oó]|\bfallo\b|no pude|inv[aá]lid/i;
const TIMEOUT_MS = 30000;

function corto(t, max = 140) {
  const x = String(t || '').replace(/\s+/g, ' ').trim();
  return x.length > max ? x.slice(0, max) + '…' : x;
}

function leerFuente(comando) {
  try { return comando._rutaArchivo ? fs.readFileSync(comando._rutaArchivo, 'utf-8') : null; } catch (_) { return null; }
}

function sePuedeEjecutar(comando, fuente) {
  return CATEGORIAS_SEGURAS.has(comando.category) && !!fuente && !RIESGOSO.test(fuente);
}

// Socket de mentira: anota lo que se "envia" y contesta algo razonable al resto
function crearSockFalso(enviados) {
  const base = {
    user: { id: '5210000000000:1@s.whatsapp.net', lid: '1000000000000:1@lid' },
    sendMessage: async (jid, contenido) => { enviados.push(contenido); return { key: { id: 'PRUEBA' } }; },
    groupMetadata: async (jid) => ({ id: jid, subject: 'Grupo de prueba', participants: [] }),
    onWhatsApp: async () => []
  };
  return new Proxy(base, {
    get(objetivo, prop) {
      if (prop in objetivo) return objetivo[prop];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      return async () => null;
    }
  });
}

async function probarEjecutando(comando, comandos, prefix) {
  const enviados = [];
  const sock = crearSockFalso(enviados);
  const jid = '120363000000000000@g.us';
  const msg = {
    key: { remoteJid: jid, participant: '5210000000001@s.whatsapp.net', id: 'PRUEBA' },
    pushName: 'Prueba',
    message: { extendedTextMessage: { text: `${prefix}${comando.name}`, contextInfo: { mentionedJid: ['5210000000002@s.whatsapp.net'] } } }
  };

  let errorLanzado = null;
  let temporizador;
  const limite = new Promise((resolve) => { temporizador = setTimeout(() => { errorLanzado = `tardo mas de ${TIMEOUT_MS / 1000} s`; resolve(); }, TIMEOUT_MS); });
  const ejecucion = Promise.resolve()
    .then(() => comando.execute(sock, jid, msg, { prefix, texto: `${prefix}${comando.name}`, comandos }))
    .catch((err) => { errorLanzado = err && err.message ? err.message : String(err); });
  await Promise.race([ejecucion, limite]);
  clearTimeout(temporizador);

  const hayMedia = enviados.some((m) => m && (m.video || m.image || m.audio || m.sticker || m.document));
  if (hayMedia) return { estado: 'ok', detalle: 'mando el archivo sin problema' };

  const sinAdorno = (t) => String(t).replace(/[╭╮╰╯━┃┣┈▸⚡『』✦⬣🐼🐾❌⚠️*_]/g, ' ').replace(/ALEPANDA BOT/g, '').replace(/\s+/g, ' ').trim();
  const textos = enviados.map((m) => sinAdorno((m && (m.text || m.caption)) || '')).filter(Boolean).join(' | ');
  if (errorLanzado) return { estado: 'roto', detalle: corto(errorLanzado) };
  if (!enviados.length) return { estado: 'roto', detalle: 'no respondio nada' };
  if (SEÑAL_DE_ERROR.test(textos)) return { estado: 'roto', detalle: corto(textos) };
  return { estado: 'ok', detalle: 'responde con texto' };
}

async function probarPorUrls(fuente) {
  const d = await diagnosticarComando(fuente);
  if (!d.urls.length) return { estado: 'sin_prueba', detalle: 'no tiene URLs que probar y no es seguro ejecutarlo' };

  const malas = (d.resultados || []).filter((r) => !r.ok);
  if (!malas.length) return { estado: 'ok', detalle: 'sus URLs responden' };

  const firmes = malas.filter((r) => !r.eraDinamica || r.error);
  if (firmes.length) {
    const r = firmes[0];
    return { estado: 'roto', detalle: corto(`${r.urlOriginal} -> ${r.error || 'HTTP ' + r.status}`) };
  }
  return { estado: 'sin_prueba', detalle: 'sus URLs dependen de datos del usuario, no pude probarlas' };
}

async function probarComando(comando, comandos, prefix) {
  const fuente = leerFuente(comando);
  const ruta = comando._rutaArchivo || null;
  try {
    const r = sePuedeEjecutar(comando, fuente)
      ? await probarEjecutando(comando, comandos, prefix)
      : (fuente ? await probarPorUrls(fuente) : { estado: 'sin_prueba', detalle: 'no encontre su archivo' });
    return { ...r, ruta };
  } catch (err) {
    return { estado: 'sin_prueba', detalle: corto(`no pude probarlo: ${err.message}`), ruta };
  }
}

// Prueba varios comandos (por nombre) de a pocos a la vez. Devuelve { nombre: resultado }
async function probarComandos(nombres, comandos, prefix, concurrencia = 4) {
  const resultados = {};
  const cola = [...new Set(nombres)].filter((n) => comandos.get(n));
  const trabajador = async () => {
    while (cola.length) {
      const nombre = cola.shift();
      resultados[nombre] = await probarComando(comandos.get(nombre), comandos, prefix);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrencia, cola.length) }, trabajador));
  return resultados;
}

module.exports = { probarComandos, probarComando, sePuedeEjecutar };

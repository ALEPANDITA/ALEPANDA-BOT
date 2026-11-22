// Ayudas de los comandos animados de economía (talar, explorar, streamear, taxi, invertir, negocio, recolectar, atraco).
// La animación es UN solo mensaje que el bot va EDITANDO (sendMessage con "edit"), igual que .doxeo.
//
// Regla importante: mientras dura la animación otros comandos pueden guardar la base de datos, así que el dinero
// NUNCA se lee al empezar y se guarda al terminar. Se decide el resultado, se anima y, al FINAL, se vuelve a leer
// la base y se aplica el cambio (actualizar). Mientras tanto un cerrojo evita que la misma persona lo repita.

const { caja, advertencia, error: cajaError, porCategoria } = require('./estilo');
const { leerDB, guardarDB, getUsuario, claveCanonica } = require('./db');

const config = { PAUSA: 1100 }; // ms entre cuadros (en las pruebas se pone en 0)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const estilo = () => porCategoria('economia');

const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
const barra = (p, largo = 10) => {
  const llenos = Math.round(Math.max(0, Math.min(1, p)) * largo);
  return '▰'.repeat(llenos) + '▱'.repeat(largo - llenos);
};

function tiempo(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const restante = (usuario, campo, enfriamiento, ahora = Date.now()) =>
  Math.max(0, (Number(usuario[campo]) || 0) + enfriamiento - ahora);

const textoEspera = (ms, cosa) =>
  advertencia(`Todavía no puedes ${cosa}.\nVuelve en *${tiempo(ms)}*.`, { titulo: 'ESPERA UN POCO', estilo: estilo() });

// ---------------- cartera ----------------
// Solo lectura: la ficha de la persona y su llave única (la que une sus ids @lid y número).
function ficha(remitente) {
  const db = leerDB();
  return { usuario: getUsuario(db, remitente), llave: claveCanonica(db, remitente) };
}

// Lee la base, aplica el cambio y guarda. Devuelve lo que devuelva "cambiar(usuario)".
function actualizar(remitente, cambiar) {
  const db = leerDB();
  const usuario = getUsuario(db, remitente);
  const resultado = cambiar(usuario, db);
  guardarDB(db);
  return resultado;
}

// ---------------- cerrojo + errores ----------------
const enCurso = new Set();

// Corre "fn" (la animación completa). Si la misma persona ya está en eso, avisa. Si algo falla, no se cobra nada.
async function correr(sock, jid, msg, clave, fn) {
  if (enCurso.has(clave)) {
    await sock.sendMessage(jid, {
      text: advertencia('Ya estás en eso, espera a que termine.', { titulo: 'UN MOMENTO', estilo: estilo() })
    }, { quoted: msg });
    return false;
  }
  enCurso.add(clave);
  try {
    await fn();
    return true;
  } catch (e) {
    console.error(`[economia] ${clave}:`, e);
    try {
      await sock.sendMessage(jid, { text: cajaError('Algo salió mal y no se cobró nada. Inténtalo de nuevo.', { titulo: 'ERROR', estilo: estilo() }) }, { quoted: msg });
    } catch (_) { /* sin conexión: ya quedó en el log */ }
    return false;
  } finally {
    enCurso.delete(clave);
  }
}

// ---------------- animación: un mensaje que se edita ----------------
function crearAnimacion(sock, jid, msg, { titulo, mentions } = {}) {
  let clave = null;
  let editable = true;
  const dibujar = (lineas, t) => caja([].concat(lineas), { titulo: t || titulo, estilo: estilo() });
  const menciones = () => (typeof mentions === 'function' ? mentions() : mentions); // puede cambiar entre cuadros

  async function editar(text) {
    try {
      await sock.sendMessage(jid, { text, edit: clave, mentions: menciones() });
      return true;
    } catch (e) {
      editable = false;
      console.error('[eco-anim] no se pudo editar:', e && e.message ? e.message : e);
      return false;
    }
  }

  return {
    // Muestra un cuadro (el primero manda el mensaje, los demás lo editan) y espera un poco
    async paso(lineas, { pausa = config.PAUSA, titulo: t } = {}) {
      const text = dibujar(lineas, t);
      if (!clave) {
        const enviado = await sock.sendMessage(jid, { text, mentions: menciones() }, { quoted: msg });
        clave = enviado && enviado.key ? enviado.key : null;
        if (!clave) editable = false;
      } else if (editable) {
        await editar(text);
      }
      if (pausa) await esperar(pausa);
    },
    // Cuadro final. Si el mensaje no se pudo editar, el resultado se manda como mensaje nuevo para no perderlo.
    async final(lineas, { titulo: t } = {}) {
      const text = dibujar(lineas, t);
      if (clave && editable && (await editar(text))) return;
      await sock.sendMessage(jid, { text, mentions: menciones() }, { quoted: msg });
    }
  };
}

module.exports = {
  config, esperar, dinero, aleatorio, elegir, barra, tiempo, restante, textoEspera,
  ficha, actualizar, correr, crearAnimacion
};

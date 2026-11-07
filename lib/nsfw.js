// Bloqueo de comandos NSFW. UNA sola regla que usan el bot principal, los subbots y los botones del menu.
//
//  - Un comando es NSFW si su categoria es 'nsfw' o 'nsfw2', si trae `nsfw: true`, o si esta en NOMBRES_NSFW.
//  - En un GRUPO solo funcionan si un owner los activo (.tnsfw on). Viene apagado por defecto.
//  - Aunque el grupo los tenga activos, solo los usan personas REGISTRADAS con 18 años o mas (.registrar).
//  - En PRIVADO solo los usa un owner.
//  - Si algo falla al revisar, NO se deja pasar (mejor bloquear de mas que mostrar esto a un menor).
const { leerDB, guardarDB, getGrupo } = require('./db');
const { leerConfig } = require('./config');
const { esOwnerBot } = require('./permisos');

const CATEGORIAS_NSFW = new Set(['nsfw', 'nsfw2']);
// Comandos sueltos de otras categorias con tema sexual (reacciones anime). Para quitar uno, borralo de esta lista.
const NOMBRES_NSFW = new Set(['lewd', 'impregnate']);
const EDAD_ADULTO = 18;
const EXIGIR_MAYOR_DE_EDAD = true; // false = basta con que el grupo lo tenga activo

function esCategoriaNsfw(categoria) {
  return CATEGORIAS_NSFW.has(String(categoria || '').toLowerCase());
}

function esComandoNsfw(comando) {
  if (!comando) return false;
  if (comando.nsfw === true) return true;
  return esCategoriaNsfw(comando.category) || NOMBRES_NSFW.has(String(comando.name || '').toLowerCase());
}

// Un grupo tiene los NSFW activos solo si un owner lo prendio
function grupoTieneNsfw(jid) {
  return !!getGrupo(leerDB(), jid).nsfw;
}

// Devuelve { permitido: true } o { permitido: false, texto } (texto = lo que se le contesta a quien lo intento)
async function revisarNsfw(sock, jid, msg, comando, { prefix = '.' } = {}) {
  if (!esComandoNsfw(comando)) return { permitido: true };
  try {
    const owner = await esOwnerBot(sock, leerConfig(), msg);

    if (!String(jid).endsWith('@g.us')) {
      if (owner) return { permitido: true };
      return { permitido: false, texto: '🔞 Los comandos NSFW solo funcionan en grupos donde un owner los activó.' };
    }

    if (!grupoTieneNsfw(jid)) {
      return {
        permitido: false,
        texto: owner
          ? `🔞 Los comandos NSFW están desactivados en este grupo.\nPara activarlos: *${prefix}tnsfw on*`
          : '🔞 Los comandos NSFW están desactivados en este grupo.'
      };
    }

    if (EXIGIR_MAYOR_DE_EDAD && !owner) {
      const { obtenerRegistro } = require('./registro');
      const reg = await obtenerRegistro(sock, msg, jid);
      if (!reg) {
        return { permitido: false, texto: `🔞 Para usar comandos NSFW tienes que registrarte primero (solo mayores de ${EDAD_ADULTO}).\nEscribe: *${prefix}registrar <nombre> <edad> <hombre o mujer>*` };
      }
      const edad = Number(reg.usuario && reg.usuario.registro && reg.usuario.registro.edad);
      if (!(edad >= EDAD_ADULTO)) {
        return { permitido: false, texto: `🔞 Este contenido es solo para mayores de ${EDAD_ADULTO} años.` };
      }
    }
    return { permitido: true };
  } catch (err) {
    console.error('[nsfw] No pude revisar el permiso, se bloquea por seguridad:', err && err.message ? err.message : err);
    return { permitido: false, texto: '🔞 No pude comprobar el permiso para este comando. Intenta de nuevo en un momento.' };
  }
}

// Atajo: revisa y, si no se puede, contesta. Devuelve true si el comando puede seguir.
async function permitirNsfw(sock, jid, msg, comando, opc) {
  const r = await revisarNsfw(sock, jid, msg, comando, opc);
  if (r.permitido) return true;
  try { if (r.texto) await sock.sendMessage(jid, { text: r.texto }, { quoted: msg }); } catch (_) { /* sin mas que hacer */ }
  return false;
}

// Una sola vez (la primera vez que arranca con este cambio): apaga el NSFW en todos los grupos,
// para que solo funcione donde un owner lo vuelva a activar. Devuelve cuantos grupos tenian NSFW prendido.
function apagarNsfwUnaVez() {
  const db = leerDB();
  if (db.nsfwReiniciado) return 0;
  let apagados = 0;
  for (const grupo of Object.values(db.grupos || {})) {
    if (grupo && grupo.nsfw) { grupo.nsfw = false; apagados++; }
  }
  db.nsfwReiniciado = Date.now();
  guardarDB(db);
  return apagados;
}

module.exports = {
  esComandoNsfw, esCategoriaNsfw, grupoTieneNsfw, revisarNsfw, permitirNsfw, apagarNsfwUnaVez,
  EDAD_ADULTO, NOMBRES_NSFW, CATEGORIAS_NSFW
};

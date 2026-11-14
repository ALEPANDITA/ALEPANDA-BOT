// Bloqueo de comandos NSFW. UNA sola regla que usan el bot principal, los subbots y los botones del menu.
//
//  - Un comando es NSFW si su categoria es 'nsfw' o 'nsfw2', si trae `nsfw: true`, o si esta en NOMBRES_NSFW.
//  - En un GRUPO solo funcionan si un owner los activo (.tnsfw on). Viene apagado por defecto.
//  - Quien este registrado (.registrar) con menos de 18 no los usa ni los activa (owners incluidos), y en un grupo con
//    NSFW activado quien no es owner tiene que estar registrado.
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

// ¿Quien escribe esta registrado (.registrar) con menos de 18 años? Aplica a todos, owners incluidos.
// Devuelve { registrado, menor }.
async function estadoDeEdad(sock, jid, msg) {
  const { obtenerRegistro } = require('./registro');
  const reg = await obtenerRegistro(sock, msg, jid);
  const edad = Number(reg && reg.usuario && reg.usuario.registro && reg.usuario.registro.edad);
  return { registrado: !!reg, menor: !!reg && edad > 0 && edad < EDAD_ADULTO };
}

const TEXTO_MENOR = `🔞 Este contenido es solo para mayores de ${EDAD_ADULTO} años.`;

// Para .tnsfw / .enable nsfw: true si quien lo intenta esta registrado como menor (no puede activarlo ni usarlo)
async function esMenorRegistrado(sock, jid, msg) {
  try { return (await estadoDeEdad(sock, jid, msg)).menor; } catch (_) { return true; } // si no se puede comprobar, no se deja
}

// Devuelve { permitido: true } o { permitido: false, texto } (texto = lo que se le contesta a quien lo intento)
async function revisarNsfw(sock, jid, msg, comando, { prefix = '.' } = {}) {
  if (!esComandoNsfw(comando)) return { permitido: true };
  try {
    const owner = await esOwnerBot(sock, leerConfig(), msg);
    const edad = await estadoDeEdad(sock, jid, msg);

    // Menor de 18 registrado: no, en ningun lado (tampoco siendo owner)
    if (edad.menor) return { permitido: false, texto: TEXTO_MENOR };

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

    // Grupo con NSFW activado: quien no es owner tiene que estar registrado (y ya sabemos que no es menor)
    if (EXIGIR_MAYOR_DE_EDAD && !owner && !edad.registrado) {
      return { permitido: false, texto: `🔞 Para usar comandos NSFW tienes que registrarte primero (solo mayores de ${EDAD_ADULTO}).\nEscribe: *${prefix}registrar <nombre> <edad> <hombre o mujer>*` };
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
  esComandoNsfw, esCategoriaNsfw, grupoTieneNsfw, revisarNsfw, permitirNsfw, apagarNsfwUnaVez, esMenorRegistrado, TEXTO_MENOR,
  EDAD_ADULTO, NOMBRES_NSFW, CATEGORIAS_NSFW
};

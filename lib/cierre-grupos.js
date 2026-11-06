// Cierre de grupos con tiempo (.cerrar 30m / 2h / 1d): el bot cierra el grupo (solo admins escriben) y lo abre solo
// cuando se acaba el tiempo. Se guarda en database.json (db.cierresGrupos), asi que sobrevive a un reinicio del bot:
// si venció mientras estaba apagado, se abre en cuanto vuelve a conectar.
const { leerDB, guardarDB } = require('./db');
const { formatearFecha, formatearDuracion } = require('./tiempo-grupos');

const MINUTO = 60 * 1000;
const UNIDADES = { s: 1000, m: MINUTO, min: MINUTO, h: 60 * MINUTO, d: 24 * 60 * MINUTO };
const MAX_MS = 30 * UNIDADES.d;
const MAX_REINTENTOS = 10; // si no se puede abrir (el bot ya no es admin, salio del grupo...) se rinde despues de ~5 min (una vuelta cada 30 s)

// "30m" -> 1800000 | "2h" -> 7200000 | "1h30m" / "1h 30m" -> 5400000 | "90" -> 90 minutos (sin unidad = minutos)
// Devuelve null si no es una duracion valida (menos de 1 minuto o mas de 30 dias tambien se rechazan).
function parsearDuracionCierre(texto) {
  const t = String(texto || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let ms = 0;
  if (/^\d{1,5}$/.test(t)) {
    ms = Number(t) * MINUTO;
  } else {
    const partes = t.match(/^(?:\d{1,5}(?:min|s|m|h|d))+$/);
    if (!partes) return null;
    for (const [, n, u] of t.matchAll(/(\d{1,5})(min|s|m|h|d)/g)) ms += Number(n) * UNIDADES[u];
  }
  if (!ms || ms < MINUTO || ms > MAX_MS) return null;
  return ms;
}

const soloNumero = (id) => String(id || '').split('@')[0].split(':')[0];

function leerCierres(db) {
  if (!db.cierresGrupos || typeof db.cierresGrupos !== 'object') db.cierresGrupos = {};
  return db.cierresGrupos;
}

// Programa (o reemplaza) la apertura automatica de un grupo. `bot` = numero del bot que lo cerro (solo ese lo abre).
function programarApertura({ jidGrupo, ms, bot, por, ahora = Date.now() }) {
  const db = leerDB();
  const cierres = leerCierres(db);
  const entrada = { jid: jidGrupo, inicio: ahora, vence: ahora + ms, bot: soloNumero(bot), por: por || null, intentos: 0 };
  cierres[jidGrupo] = entrada;
  guardarDB(db);
  return entrada;
}

function obtenerCierre(jidGrupo) {
  return leerCierres(leerDB())[jidGrupo] || null;
}

// Cancela la apertura automatica (porque abrieron a mano, o cerraron sin limite). Devuelve la entrada quitada o null.
function cancelarApertura(jidGrupo) {
  const db = leerDB();
  const cierres = leerCierres(db);
  const entrada = cierres[jidGrupo] || null;
  if (!entrada) return null;
  delete cierres[jidGrupo];
  guardarDB(db);
  return entrada;
}

// Abre los grupos cuyo tiempo ya vencio. Devuelve cuantos abrio. Solo toca los que cerro ESTE bot (por su numero).
async function revisarAperturas(sock, ahora = Date.now()) {
  const yo = soloNumero(sock.user && sock.user.id);
  const pendientes = Object.values(leerCierres(leerDB())).filter((e) => e.vence <= ahora && (!e.bot || e.bot === yo));
  let abiertos = 0;
  for (const e of pendientes) {
    try {
      await sock.groupSettingUpdate(e.jid, 'not_announcement');
    } catch (err) {
      const db = leerDB();
      const actual = leerCierres(db)[e.jid];
      if (!actual || actual.vence !== e.vence) continue; // lo cambiaron mientras tanto
      actual.intentos = (actual.intentos || 0) + 1;
      console.error('[cerrar] No pude abrir', e.jid, `(intento ${actual.intentos}/${MAX_REINTENTOS}) -`, err && err.message ? err.message : err);
      if (actual.intentos >= MAX_REINTENTOS) {
        delete leerCierres(db)[e.jid];
        guardarDB(db);
        try { await sock.sendMessage(e.jid, { text: '⚠️ Se acabo el tiempo del cierre pero no pude abrir el grupo (¿sigo siendo admin?). Un admin puede abrirlo manualmente.' }); } catch (_) { /* sin mas que hacer */ }
      } else {
        guardarDB(db);
      }
      continue;
    }
    // Se vuelve a leer la base: pudo cambiar mientras se abria (ej. cerraron otra vez con otro tiempo)
    const fresca = leerDB();
    const actual = leerCierres(fresca)[e.jid];
    if (actual && actual.vence === e.vence) {
      delete leerCierres(fresca)[e.jid];
      guardarDB(fresca);
    }
    abiertos++;
    try {
      await sock.sendMessage(e.jid, { text: `🔓 *Se acabo el tiempo del cierre* (${formatearDuracion(e.vence - e.inicio)}).\nGrupo abierto: todos pueden escribir.` });
    } catch (_) { /* el grupo ya quedo abierto aunque no se pudo avisar */ }
  }
  return abiertos;
}

let vigilante = null;
function iniciarVigilanteCierres(sock) {
  if (vigilante) clearInterval(vigilante);
  const vuelta = () => revisarAperturas(sock).catch((err) => console.error('[cerrar] Error revisando cierres:', err && err.message ? err.message : err));
  setTimeout(vuelta, 10 * 1000); // al conectar: abre los que vencieron mientras el bot estaba apagado
  vigilante = setInterval(vuelta, 30 * 1000);
  return vigilante;
}

module.exports = {
  parsearDuracionCierre, programarApertura, obtenerCierre, cancelarApertura,
  revisarAperturas, iniciarVigilanteCierres, formatearFecha, formatearDuracion
};

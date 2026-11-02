// Tiempo de uso del bot por grupo (.time).
//
// El owner programa cuanto dura el bot en un grupo (ej. ".time 30d <link del grupo>"). Se guarda en
// database.json (db.tiempoGrupos) y un vigilante revisa cada minuto; cuando el tiempo se acaba le
// manda un mensaje PRIVADO a quien lo programo para que saque al bot de ese grupo.
// Si el bot estaba apagado cuando vencio, el aviso sale en cuanto vuelve a conectar.
const { leerDB, guardarDB } = require('./db');
const { SUPER_OWNER } = require('./superowner');

const ZONA = 'America/Tijuana';
const MINUTO = 60 * 1000;
const UNIDADES = { s: 1000, m: MINUTO, min: MINUTO, h: 60 * MINUTO, d: 24 * 60 * MINUTO, w: 7 * 24 * 60 * MINUTO, sem: 7 * 24 * 60 * MINUTO };
const MAX_MS = 3650 * UNIDADES.d; // 10 anios

// "30d" -> { ms: 2592000000, suma: false } | "+15d" -> { ms, suma: true } | null si no es una duracion valida.
// Sin unidad se toman dias ("30" = 30 dias).
function parsearDuracion(texto) {
  const m = String(texto || '').trim().toLowerCase().match(/^(\+?)(\d{1,5})\s*(s|min|m|h|d|w|sem)?$/);
  if (!m) return null;
  const ms = Number(m[2]) * UNIDADES[m[3] || 'd'];
  if (!ms || ms < MINUTO || ms > MAX_MS) return null;
  return { ms, suma: m[1] === '+' };
}

// Saca el codigo de invitacion de un link de grupo (con o sin https://).
function extraerCodigoInvitacion(texto) {
  const m = String(texto || '').match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{16,32})/i);
  return m ? m[1] : null;
}

function formatearFecha(ms) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

// 2592000000 -> "30d" | "5d 3h" | "2h 10min" | "45min"
function formatearDuracion(ms) {
  const total = Math.max(0, Math.round(ms / MINUTO));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const min = total % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return min ? `${h}h ${min}min` : `${h}h`;
  return `${min}min`;
}

function leerTiempos(db) {
  if (!db.tiempoGrupos || typeof db.tiempoGrupos !== 'object') db.tiempoGrupos = {};
  return db.tiempoGrupos;
}

// Registra (o renueva) el tiempo de un grupo.
//   suma=true  -> se agrega al tiempo que le quedaba (o a partir de ahora si ya habia vencido)
//   suma=false -> el tiempo empieza a contar desde ahora
// Devuelve { entrada, anterior } (anterior = el registro previo del grupo, si existia).
function registrarTiempo({ jidGrupo, nombre, codigo, ms, suma = false, avisarA, ahora = Date.now() }) {
  const db = leerDB();
  const tiempos = leerTiempos(db);
  const anterior = tiempos[jidGrupo] || null;
  const base = suma && anterior && anterior.vence > ahora ? anterior.vence : ahora;
  const entrada = {
    jid: jidGrupo,
    nombre: nombre || (anterior && anterior.nombre) || jidGrupo,
    codigo: codigo || (anterior && anterior.codigo) || null,
    inicio: anterior && suma && anterior.vence > ahora ? anterior.inicio : ahora,
    vence: base + ms,
    avisarA: avisarA || (anterior && anterior.avisarA) || SUPER_OWNER,
    avisado: false
  };
  tiempos[jidGrupo] = entrada;
  guardarDB(db);
  return { entrada, anterior };
}

// Lista ordenada: primero lo que vence antes.
function listarTiempos() {
  return Object.values(leerTiempos(leerDB())).sort((a, b) => a.vence - b.vence);
}

// Quita por numero de la lista (1, 2, ...), por JID del grupo o por codigo de invitacion. Devuelve la entrada quitada o null.
function quitarTiempo(referencia) {
  const db = leerDB();
  const tiempos = leerTiempos(db);
  const lista = Object.values(tiempos).sort((a, b) => a.vence - b.vence);
  const ref = String(referencia || '').trim();
  let objetivo = null;
  if (/^\d{1,4}$/.test(ref)) objetivo = lista[Number(ref) - 1] || null;
  else objetivo = lista.find((e) => e.jid === ref || (e.codigo && e.codigo === (extraerCodigoInvitacion(ref) || ref))) || null;
  if (!objetivo) return null;
  delete tiempos[objetivo.jid];
  guardarDB(db);
  return objetivo;
}

function textoAviso(e, ahora) {
  const tarde = ahora - e.vence;
  const lineas = [
    '⏰ *SE ACABO EL TIEMPO DEL BOT*',
    '',
    `Grupo: *${e.nombre}*`,
    `Vencio: ${formatearFecha(e.vence)}${tarde > 5 * MINUTO ? ` (hace ${formatearDuracion(tarde)})` : ''}`,
    `Duracion contratada: ${formatearDuracion(e.vence - e.inicio)}`
  ];
  if (e.codigo) lineas.push(`Link: https://chat.whatsapp.com/${e.codigo}`);
  lineas.push('', 'Ya puedes sacar al bot de ese grupo. Para renovarlo: .time +30d <link del grupo>');
  return lineas.join('\n');
}

// Revisa los grupos vencidos y avisa por privado. Solo marca "avisado" si el mensaje salio de verdad
// (si falla, se reintenta en la siguiente vuelta). Devuelve cuantos avisos mando.
async function revisarVencidos(sock, ahora = Date.now()) {
  const db = leerDB();
  const pendientes = Object.values(leerTiempos(db)).filter((e) => !e.avisado && e.vence <= ahora);
  let enviados = 0;
  for (const e of pendientes) {
    try {
      await sock.sendMessage(e.avisarA || SUPER_OWNER, { text: textoAviso(e, ahora) });
    } catch (err) {
      console.error('[time] No pude avisar del grupo', e.nombre, '-', err && err.message ? err.message : err);
      continue;
    }
    // Se vuelve a leer la base: pudo cambiar mientras se mandaba el mensaje (ej. el owner renovo el grupo)
    const fresca = leerDB();
    const actual = leerTiempos(fresca)[e.jid];
    if (actual && actual.vence === e.vence) {
      actual.avisado = true;
      actual.avisadoEn = Date.now();
      guardarDB(fresca);
    }
    enviados++;
  }
  return enviados;
}

let vigilante = null;
function iniciarVigilanteTiempos(sock) {
  if (vigilante) clearInterval(vigilante);
  const vuelta = () => revisarVencidos(sock).catch((err) => console.error('[time] Error revisando tiempos:', err && err.message ? err.message : err));
  setTimeout(vuelta, 15 * 1000); // al conectar: avisa los que vencieron mientras el bot estaba apagado
  vigilante = setInterval(vuelta, MINUTO);
  return vigilante;
}

module.exports = {
  parsearDuracion, extraerCodigoInvitacion, formatearFecha, formatearDuracion,
  registrarTiempo, listarTiempos, quitarTiempo, revisarVencidos, iniciarVigilanteTiempos
};

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const CARPETA_SUBBOTS = path.join(__dirname, '..', 'subbots');
const RUTA_PRESENCIA_GRUPOS = path.join(CARPETA_SUBBOTS, 'presencia-grupos.json');
const VENTANA_PRESENCIA_MS = 10 * 60 * 1000; // 10 minutos
const RUTA_REGISTRO = path.join(CARPETA_SUBBOTS, 'registro.json');

function leerRegistro() {
  if (!fs.existsSync(CARPETA_SUBBOTS)) fs.mkdirSync(CARPETA_SUBBOTS, { recursive: true });
  if (!fs.existsSync(RUTA_REGISTRO)) {
    fs.writeFileSync(RUTA_REGISTRO, JSON.stringify({ subbots: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(RUTA_REGISTRO, 'utf-8'));
}

function guardarRegistro(registro) {
  fs.writeFileSync(RUTA_REGISTRO, JSON.stringify(registro, null, 2));
}

function nuevoId() {
  return Date.now().toString(36);
}

function rutaStatus(id) {
  return path.join(CARPETA_SUBBOTS, id, 'status.json');
}

function leerStatus(id) {
  const ruta = rutaStatus(id);
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    return null;
  }
}

async function iniciarProcesoSubbot(id, numero) {
  const nombreProceso = `subbot-${id}`;
  const scriptPath = path.join(__dirname, '..', 'subbot.js');
  const args = numero ? [id, numero] : [id];

  await execFileAsync('pm2', ['start', scriptPath, '--name', nombreProceso, '--', ...args]);

  try {
    await execFileAsync('pm2', ['save']);
  } catch {
    // no es critico
  }

  return nombreProceso;
}

async function detenerProcesoSubbot(nombreProceso) {
  try {
    await execFileAsync('pm2', ['delete', nombreProceso]);
    await execFileAsync('pm2', ['save']);
  } catch (err) {
    // si ya no existia, lo ignoramos
  }
}

// Reinicia un subbot ya existente SIN perder su sesion (pm2 restart solo
// relanza el proceso node, no toca la carpeta de auth_info). Se usa para que
// los subbots tomen el codigo nuevo de commands/ y lib/ despues de actualizar
// el bot principal, sin tener que volver a vincular el numero.
async function reiniciarProcesoSubbot(nombreProceso) {
  try {
    await execFileAsync('pm2', ['restart', nombreProceso]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function rutaConfigSubbot(id) {
  return path.join(CARPETA_SUBBOTS, id, 'config.json');
}

// Crea el config.json del subbot ANTES de arrancarlo, ya con el numero que se
// esta vinculando como unico owner. Asi, en cuanto se conecta, ese numero ya
// tiene control total de su propio subbot.
function prepararConfigSubbot(id, numero) {
  const carpeta = path.join(CARPETA_SUBBOTS, id);
  fs.mkdirSync(carpeta, { recursive: true });
  const numeroJid = `${numero}@s.whatsapp.net`;
  const config = {
    prefix: '.',
    mainOwner: numeroJid,
    owners: [numeroJid],
    soloOwner: false
  };
  fs.writeFileSync(rutaConfigSubbot(id), JSON.stringify(config, null, 2));
}

function contarSubbotsDe(creadoPor) {
  const registro = leerRegistro();
  return Object.values(registro.subbots).filter(s => s.creadoPor === creadoPor).length;
}

async function crearSubbotCompleto(numero, creadoPor, origen = 'addsubbot') {
  const id = nuevoId();
  prepararConfigSubbot(id, numero);
  const nombreProceso = await iniciarProcesoSubbot(id, numero);

  const registro = leerRegistro();
  registro.subbots[id] = {
    numero,
    creadoPor,
    origen,
    nombreProceso,
    creado: Date.now(),
    estado: 'iniciando'
  };
  guardarRegistro(registro);

  return { id, nombreProceso };
}

// Estados que cuentan como "todavia en uso" -- si el numero tiene un subbot
// en alguno de estos estados, no lo dejamos crear otro hasta que se desconecte.
const ESTADOS_ACTIVOS = new Set(['conectado', 'esperando_codigo', 'iniciando', 'reconectando']);

function buscarSubbotActivoDeNumero(numeroLimpio) {
  const registro = leerRegistro();
  for (const [id, info] of Object.entries(registro.subbots)) {
    if ((info.numero || '').replace(/[^0-9]/g, '') !== numeroLimpio) continue;
    const status = leerStatus(id);
    const estado = status?.estado || info.estado || 'iniciando';
    if (ESTADOS_ACTIVOS.has(estado)) return { id, info, estado };
  }
  return null;
}

// Consulta el estado REAL de los procesos en PM2 (no lo que el subbot dijo
// la ultima vez, sino si el proceso sigue vivo de verdad ahora mismo).
// Devuelve un mapa { nombreProceso: 'online' | 'stopped' | 'errored' | ... }
async function obtenerEstadosPM2() {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist']);
    const lista = JSON.parse(stdout);
    const mapa = {};
    for (const proc of lista) {
      mapa[proc.name] = proc.pm2_env?.status || 'desconocido';
    }
    return mapa;
  } catch {
    return {};
  }
}

// Cantidad total de "slots" que se muestran en .listsubbots (ocupados + libres).
// Solo es para la vista del comando, no limita cuantos subbots reales puede
// haber -- si necesitas mas o menos, cambia este numero.
const SLOTS_TOTALES = 20;


function leerPresenciaGrupos() {
  if (!fs.existsSync(RUTA_PRESENCIA_GRUPOS)) return {};
  try {
    return JSON.parse(fs.readFileSync(RUTA_PRESENCIA_GRUPOS, 'utf-8'));
  } catch {
    return {};
  }
}

function guardarPresenciaGrupos(data) {
  fs.writeFileSync(RUTA_PRESENCIA_GRUPOS, JSON.stringify(data, null, 2));
}

// Registra que este subbot esta activo AHORA en este grupo, y decide si le
// toca responder. Solo compite entre SUBBOTS -- el bot principal nunca pasa
// por aqui y siempre responde normal. Si hay 3 o mas subbots propios activos
// (con actividad en los ultimos 10 min) en el mismo grupo, se elige uno solo
// de forma determinista (mismo resultado en todos los procesos) para evitar
// que 3+ subbots contesten el mismo comando a la vez.
function registrarPresenciaYDecidir(groupJid, subbotId) {
  const ahora = Date.now();
  const data = leerPresenciaGrupos();
  const grupo = data[groupJid] || {};

  grupo[subbotId] = ahora;
  for (const [id, ultimoVisto] of Object.entries(grupo)) {
    if (ahora - ultimoVisto > VENTANA_PRESENCIA_MS) delete grupo[id];
  }

  data[groupJid] = grupo;
  guardarPresenciaGrupos(data);

  const activos = Object.keys(grupo);
  if (activos.length <= 2) return true;

  const elegido = activos.sort()[0];
  return elegido === subbotId;
}

module.exports = {
  leerRegistro,
  guardarRegistro,
  nuevoId,
  leerStatus,
  rutaStatus,
  iniciarProcesoSubbot,
  detenerProcesoSubbot,
  reiniciarProcesoSubbot,
  prepararConfigSubbot,
  contarSubbotsDe,
  crearSubbotCompleto,
  buscarSubbotActivoDeNumero,
  obtenerEstadosPM2,
  SLOTS_TOTALES,
  CARPETA_SUBBOTS,
  registrarPresenciaYDecidir
};

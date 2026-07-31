// Subbot independiente: cada subbot corre en su PROPIO proceso (levantado por PM2),
// con su propia sesion de WhatsApp y su propio config.json, totalmente separado
// del bot principal y de los demas subbots.
const path = require('path');
const fs = require('fs');
// Mismo fix que en index.js: fsociety-Baileys exporta makeWASocket como
// nombrado (sin "default"), a diferencia del fsociety-Baileys clasico.
const _baileysModSub = require('@whiskeysockets/baileys');
const _baileysSub = _baileysModSub.makeWASocket ? _baileysModSub : (_baileysModSub.default || _baileysModSub);
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, Browsers } = _baileysSub;
if (typeof makeWASocket !== 'function') {
  console.error('ERROR CRITICO: makeWASocket no se pudo importar de fsociety-Baileys en subbot.js.');
  process.exit(1);
}
const pino = require('pino');
const { leerRegistro, guardarRegistro, detenerProcesoSubbot, registrarPresenciaYDecidir } = require('./lib/subbots');
const { verificarLimiteDescarga, registrarDescarga } = require('./lib/subbot-limits');

const SUBBOT_ID = process.argv[2];
const NUMERO_PARA_CODIGO = process.argv[3];

if (!SUBBOT_ID) {
  console.error('Falta el ID del subbot. Uso: node subbot.js <id> [numero]');
  process.exit(1);
}

const CARPETA_SUBBOT = path.join(__dirname, 'subbots', SUBBOT_ID);
const CARPETA_AUTH = path.join(CARPETA_SUBBOT, 'auth_info');
const RUTA_STATUS = path.join(CARPETA_SUBBOT, 'status.json');
const RUTA_CONFIG = path.join(CARPETA_SUBBOT, 'config.json');

fs.mkdirSync(CARPETA_AUTH, { recursive: true });

function escribirStatus(data) {
  fs.writeFileSync(RUTA_STATUS, JSON.stringify({ ...data, actualizado: Date.now() }, null, 2));
}

function leerConfigSubbot() {
  if (!fs.existsSync(RUTA_CONFIG)) {
    const inicial = { prefix: '.', owners: [], mainOwner: null };
    fs.writeFileSync(RUTA_CONFIG, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  return JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf-8'));
}

// Estos comandos solo tiene sentido usarlos desde el bot principal.
// Si un subbot pudiera usarlos, cualquiera podria crear/borrar subbots en cadena
// desde dentro de otro subbot, sin control.
const COMANDOS_BLOQUEADOS_EN_SUBBOT = new Set(['addsubbot', 'delsubbot', 'listsubbots', 'code', 'serbot', 'subbot', 'crearsubbot']);

// Busca archivos .js dentro de una carpeta, incluyendo subcarpetas (para las
// carpetas por API dentro de cada categoria, ej: download/dvyer/*.js)
function listarJsRecursivo(dir) {
  let resultado = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const rutaCompleta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado = resultado.concat(listarJsRecursivo(rutaCompleta));
    } else if (entrada.name.endsWith('.js')) {
      resultado.push(rutaCompleta);
    }
  }
  return resultado;
}

function cargarComandos() {
  const comandos = new Map();
  const basePath = path.join(__dirname, 'commands');
  const categorias = fs.readdirSync(basePath);

  for (const categoria of categorias) {
    const catPath = path.join(basePath, categoria);
    if (!fs.statSync(catPath).isDirectory()) continue;

    // Los subbots creados con .code/.serbot (autoservicio: cualquiera puede
    // pedir uno para si mismo) nunca cargan la categoria 'owner' completa.
    // Los subbots creados con .addsubbot (el owner se lo entrega directamente
    // a alguien de confianza) SI cargan 'owner' con normalidad -- solo se les
    // quita eval y exec, filtrando esos dos archivos puntuales mas abajo.
    if (categoria === 'owner' && origenSubbot === 'serbot') continue;

    const archivos = listarJsRecursivo(catPath)
      .filter(ruta => !(categoria === 'owner' && (path.basename(ruta) === 'eval.js' || path.basename(ruta) === 'exec.js')));
    for (const rutaArchivo of archivos) {
      const archivo = path.basename(rutaArchivo);
      try {
        const exportado = require(rutaArchivo);
        const lista = Array.isArray(exportado) ? exportado : [exportado];
        for (const comando of lista) {
          if (!comando?.name || typeof comando.execute !== 'function') continue;
          if (COMANDOS_BLOQUEADOS_EN_SUBBOT.has(comando.name)) continue;
          comandos.set(comando.name, comando);
          if (comando.aliases) {
            for (const alias of comando.aliases) {
              if (COMANDOS_BLOQUEADOS_EN_SUBBOT.has(alias)) continue;
              comandos.set(alias, comando);
            }
          }
        }
      } catch (err) {
        console.error(`[subbot ${SUBBOT_ID}] Error cargando ${archivo}:`, err.message);
      }
    }
  }
  return comandos;
}

const registroInicial = leerRegistro();
const origenSubbot = registroInicial.subbots[SUBBOT_ID]?.origen || 'addsubbot';

const comandos = cargarComandos();

let autoEliminado = false;

// Borra este subbot solo: su registro, su carpeta (sesion incluida) y su
// propio proceso de PM2. Se usa tanto si nunca lo vincularon a tiempo como
// si mas tarde alguien cierra sesion desde su telefono (sin usar .desconectar).
async function autoEliminarSubbot(motivo) {
  if (autoEliminado) return;
  autoEliminado = true;

  console.log(`[subbot ${SUBBOT_ID}] Auto-eliminando (${motivo})...`);

  const registro = leerRegistro();
  const info = registro.subbots[SUBBOT_ID];
  if (info) {
    delete registro.subbots[SUBBOT_ID];
    guardarRegistro(registro);
  }

  setTimeout(() => {
    if (fs.existsSync(CARPETA_SUBBOT)) fs.rmSync(CARPETA_SUBBOT, { recursive: true, force: true });
    if (info?.nombreProceso) detenerProcesoSubbot(info.nombreProceso).catch(() => {});
  }, 1000);
}

async function iniciarSubbot() {
  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_AUTH);
  const necesitaVincular = !state.creds.registered;
  const { version } = await fetchLatestWaWebVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    defaultQueryTimeoutMs: undefined
  });

  let pidiendoCodigo = false;
  let vinculadoConExito = false;

  async function pedirCodigoDeVinculacion() {
    if (pidiendoCodigo) return;
    pidiendoCodigo = true;

    let codigo = null;
    let ultimoError = null;

    for (let intento = 1; intento <= 5 && !codigo; intento++) {
      try {
        if (intento > 1) await new Promise(resolve => setTimeout(resolve, 3000 * intento));
        codigo = await sock.requestPairingCode(NUMERO_PARA_CODIGO.trim(), 'ALEPANDA');
      } catch (err) {
        ultimoError = err;
        console.error(`[subbot ${SUBBOT_ID}] Intento ${intento} de pedir codigo fallo:`, err?.message || err);
      }
    }

    pidiendoCodigo = false;

    if (!codigo) {
      escribirStatus({ estado: 'error', error: ultimoError?.message || 'No se pudo obtener el codigo despues de varios intentos' });
      console.error(`[subbot ${SUBBOT_ID}] Error pidiendo codigo tras varios intentos:`, ultimoError);
      return;
    }

    escribirStatus({ estado: 'esperando_codigo', codigo });
    console.log(`[subbot ${SUBBOT_ID}] Codigo de vinculacion: ${codigo}`);

    // Si en 1 minuto no completaron la vinculacion (connection nunca llega a
    // 'open'), este subbot se elimina solo -- asi no quedan sesiones a medias
    // ocupando espacio y procesos sin usar.
    setTimeout(() => {
      if (!vinculadoConExito) {
        autoEliminarSubbot('no se vinculo dentro de 1 minuto');
      }
    }, 60 * 1000);
  }

  sock.ev.on('creds.update', saveCreds);

  let procesoDeVinculacionIniciado = false;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // El codigo de vinculacion SOLO se puede pedir cuando llega el "qr" interno de Baileys
    // (aunque no lo usemos para escanear, es la señal de que el handshake avanzo lo
    // suficiente para que el socket pueda enviar la solicitud). Pedirlo antes -- ya sea
    // de inmediato al crear el socket, o en connection === 'connecting' -- truena con
    // "Error: Connection Closed" (428 Precondition Required) porque el socket todavia
    // no esta listo para mandar nada.
    if (necesitaVincular && NUMERO_PARA_CODIGO && qr && !procesoDeVinculacionIniciado) {
      procesoDeVinculacionIniciado = true;
      pedirCodigoDeVinculacion();
    }

    if (connection === 'open') {
      vinculadoConExito = true;
      escribirStatus({ estado: 'conectado', numero: sock.user?.id?.split(':')[0] || null });
      console.log(`[subbot ${SUBBOT_ID}] Conectado correctamente.`);
    }

    if (connection === 'close') {
      const codigoError = lastDisconnect?.error?.output?.statusCode;
      const desconectadoPermanente = codigoError === DisconnectReason.loggedOut;

      if (desconectadoPermanente) {
        console.log(`[subbot ${SUBBOT_ID}] Sesion cerrada (logout). Auto-eliminando...`);
        autoEliminarSubbot('sesion cerrada (logout)');
      } else {
        escribirStatus({ estado: 'reconectando' });
        iniciarSubbot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;

    const jid = msg.key.remoteJid;
    const texto = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      ''
    ).trim();

    const config = leerConfigSubbot();
    const prefix = config.prefix || '.';

    // En un subbot, el owner vincula su PROPIO numero, asi que sus comandos
    // llegan marcados como "fromMe". Ya no descartamos esos mensajes por
    // default -- solo ignoramos cualquier mensaje (sea fromMe o no) que no
    // empiece con el prefijo, para no reprocesar las respuestas del bot.
    if (!texto.startsWith(prefix)) return;

    const args = texto.slice(prefix.length).trim().split(/\s+/);
    const nombreComando = (args[0] || '').toLowerCase();
    const comando = comandos.get(nombreComando);
    if (!comando) return;

    // Si 3 o mas subbots propios estan activos en este mismo grupo, solo uno
    // (elegido de forma consistente entre todos los procesos) responde --
    // asi evitamos que el mismo comando se conteste varias veces. El bot
    // principal nunca pasa por aqui, siempre responde normal.
    if (jid.endsWith('@g.us')) {
      const debeResponder = registrarPresenciaYDecidir(jid, SUBBOT_ID);
      if (!debeResponder) return;
    }

    if (comando.category === 'download') {
      const registro = leerRegistro();
      const infoSubbot = registro.subbots[SUBBOT_ID];

      if (infoSubbot?.origen === 'serbot') {
        const { permitido, restantes } = verificarLimiteDescarga(SUBBOT_ID);

        if (!permitido) {
          await sock.sendMessage(jid, {
            text: '⚠️ Este subbot alcanzo su limite de 100 descargas de hoy. Se reinicia automaticamente mañana.'
          }, { quoted: msg });
          return;
        }

        registrarDescarga(SUBBOT_ID);

        if (restantes <= 10) {
          await sock.sendMessage(jid, {
            text: `ℹ️ Te quedan ${restantes - 1} descargas hoy en este subbot.`
          }, { quoted: msg });
        }
      }
    }

    try {
      await comando.execute(sock, jid, msg, { prefix, texto, comandos, esSubbot: true, subbotId: SUBBOT_ID });
    } catch (err) {
      console.error(`[subbot ${SUBBOT_ID}] Error en comando "${nombreComando}":`, err);
    }
  });
}

iniciarSubbot().catch(err => {
  console.error(`[subbot ${SUBBOT_ID}] Error fatal al iniciar:`, err);
  escribirStatus({ estado: 'error', error: err.message });
  process.exit(1);
});

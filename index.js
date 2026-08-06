require('net').setDefaultAutoSelectFamily(false);
require('dns').setDefaultResultOrder('ipv4first');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, Browsers } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const readline = require('readline');
const pino = require('pino');

const { leerConfig } = require('./lib/config');
const { esOwnerBot } = require('./lib/permisos');
const { leerDB, getGrupo, getUsuario } = require('./lib/db');
const { construirTexto, construirPayloadEnvio, obtenerMediaGuardada, obtenerFotoPerfilSegura } = require('./lib/bienvenidapro');

const fs = require('fs');
const path = require('path');

const CACHE_METADATA_TTL_MS = 5 * 60 * 1000;
const cacheMetadataGrupos = new Map();

async function obtenerMetadataCacheada(sock, jid, forzar = false) {
  const cacheado = cacheMetadataGrupos.get(jid);
  if (!forzar && cacheado && (Date.now() - cacheado.ts) < CACHE_METADATA_TTL_MS) {
    return cacheado.data;
  }
  const data = await sock.groupMetadata(jid);
  cacheMetadataGrupos.set(jid, { data, ts: Date.now() });
  return data;
}

const EMOJIS_POR_CATEGORIA = {
  download: '🔍', fun: '🎉', admin: '🛠️', economia: '💰', casino: '🎰',
  owner: '👑', ia: '🤖', general: 'ℹ️', perfil: '🪪', default: '⚡', nsfw: '💗'
};

function normalizarComando(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

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
    const archivos = listarJsRecursivo(catPath);
    for (const rutaArchivo of archivos) {
      const exportado = require(rutaArchivo);
      const lista = Array.isArray(exportado) ? exportado : [exportado];
      for (const comando of lista) {
        if (!comando._rutaArchivo) comando._rutaArchivo = rutaArchivo;
        comandos.set(comando.name, comando);
        if (Array.isArray(comando.aliases)) {
          for (const alias of comando.aliases) comandos.set(alias, comando);
        }
      }
    }
  }
  return comandos;
}

function logMensaje({ remitente, texto, esGrupo }) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tipo = esGrupo ? chalk.bgMagenta.black.bold(' GRUPO ') : chalk.bgCyan.black.bold(' PRIVADO ');
  const textoCorto = texto.length > 100 ? texto.slice(0, 100) + '…' : texto;
  console.log(chalk.gray('┌─────────────────────────────────────────'));
  console.log(chalk.gray('│ ') + chalk.yellowBright.bold('💬 Mensaje nuevo') + '  ' + tipo);
  console.log(chalk.gray('│ ') + chalk.greenBright('👤 Remitente: ') + chalk.whiteBright(remitente));
  console.log(chalk.gray('│ ') + chalk.blueBright('🕐 Hora: ') + chalk.whiteBright(hora));
  console.log(chalk.gray('│ ') + chalk.magentaBright('✉️  Mensaje: ') + chalk.white(textoCorto));
  console.log(chalk.gray('└─────────────────────────────────────────'));
}

console.log('📦 Cargando comandos...');
const comandos = cargarComandos();
console.log(`✅ ${comandos.size} comandos/alias cargados sin errores.`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pregunta = (texto) => new Promise((resolve) => rl.question(texto, resolve));

process.on('uncaughtException', (err) => { console.error('Error no capturado:', err); });
process.on('unhandledRejection', (err) => { console.error('Promesa rechazada sin manejar (COMPLETO):', err); });

let reiniciando = false;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  console.log('📂 Sesión auth_info cargada.');
  const { version } = await fetchLatestWaWebVersion();
  console.log('🌐 Version de WhatsApp Web obtenida:', version);

  let metodo = null;
  let yaRegistrado = false;
  try {
    const credsPath = path.join(__dirname, 'auth_info', 'creds.json');
    if (fs.existsSync(credsPath)) {
      const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      yaRegistrado = credsData.registered === true;
    }
  } catch (e) {
    yaRegistrado = false;
  }

  if (!yaRegistrado) {
    if (process.stdout.isTTY) {
      console.log('Seleccione una opcion:');
      console.log('1. Con codigo QR');
      console.log('2. Con codigo de texto de 8 digitos');
      metodo = await pregunta('> ');
    } else {
      metodo = '1';
      console.log('Modo automatico: usando QR');
    }
  }

  console.log('🔌 Intentando abrir conexion con WhatsApp...');
  const sock = makeWASocket({
    version,
    auth: state,
    browser: metodo?.trim() === '2' ? Browsers.macOS('Safari') : Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'error' }),
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (update.qr) console.log('✅ Llego un QR nuevo.');
    console.log('📶 Estado de conexion:', connection || '(sin cambio)');
    if (lastDisconnect?.error) console.log('⚠️  Motivo de desconexion:', lastDisconnect.error.message);

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('❌ Se cerró la conexión. Razón:', reason, lastDisconnect?.error?.message);
      if (reason === DisconnectReason.loggedOut) {
        console.log('Sesion cerrada, borra la carpeta auth_info y vuelve a intentar.');
        return;
      }
      if (reason === DisconnectReason.restartRequired) {
        console.log('WhatsApp pidio reiniciar la conexion (normal durante pairing). Reiniciando...');
        if (!reiniciando) { reiniciando = true; setTimeout(() => { reiniciando = false; startBot(); }, 1500); }
        return;
      }
      if (sock.authState.creds.registered) {
        if (reiniciando) return;
        reiniciando = true;
        setTimeout(() => { reiniciando = false; startBot(); }, 2000);
      } else {
        console.log('Conexion cerrada durante pairing/QR.');
      }
      return;
    }

    if (connection === 'open') {
      console.log(chalk.green.bold('✅ Bot conectado correctamente (ETAPA 5 - COMPLETA)'));
      setInterval(async () => {
        try {
          const { leerDB } = require('./lib/db');
          const { finalizarSubastasVencidas } = require('./lib/mercado');
          const { finalizarSubastasVencidasAnime } = require('./lib/mercadoanime');
          const db = leerDB();
          await finalizarSubastasVencidas(sock, db);
          await finalizarSubastasVencidasAnime(sock, db);
        } catch (err) {
          console.error('[subastas] Error revisando subastas vencidas:', err);
        }
      }, 30 * 1000);
    }
  });

  if (!sock.authState.creds.registered) {
    if (metodo?.trim() === '1') {
      sock.ev.on('connection.update', (update) => {
        if (update.qr) {
          qrcode.generate(update.qr, { small: true });
          console.log('Escanea este codigo QR desde WhatsApp > Dispositivos vinculados');
        }
      });
    } else {
      const numero = await pregunta('Escribe tu numero con codigo de pais (ej: 5217712345678): ');
      let codigo = null;
      let socketCerrado = false;
      const onClose = (u) => { if (u.connection === 'close') socketCerrado = true; };
      sock.ev.on('connection.update', onClose);
      for (let intento = 1; intento <= 5 && !codigo; intento++) {
        if (socketCerrado) break;
        try {
          await new Promise(r => setTimeout(r, 5000 + 3000 * intento));
          if (socketCerrado) break;
          codigo = await sock.requestPairingCode(numero.trim());
        } catch (err) {
          console.log(`Intento ${intento} fallo:`, err.message);
        }
      }
      sock.ev.off('connection.update', onClose);
      if (!codigo) { console.log('No se pudo obtener el codigo de vinculacion.'); process.exit(1); }
      console.log(`🔑 Tu codigo de vinculacion es: ${codigo}`);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('groups.update', (actualizaciones) => {
    for (const act of actualizaciones) {
      if (act.id) cacheMetadataGrupos.delete(act.id);
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    const { id: jid, participants, action } = update;
    const config = leerConfig();
    const db = leerDB();
    const grupo = getGrupo(db, jid);

    let metadata;
    try {
      metadata = await obtenerMetadataCacheada(sock, jid);
    } catch (err) {
      return;
    }

    if (action === 'add') {
      for (const p of participants) {
        const pid = typeof p === 'string' ? p : p.id;
        if (!metadata.participants.some(x => x.id === pid)) {
          metadata.participants.push({ id: pid });
        }
      }
    } else if (action === 'remove') {
      const idsQueSalen = participants.map(p => (typeof p === 'string' ? p : p.id));
      metadata.participants = metadata.participants.filter(x => !idsQueSalen.includes(x.id));
    }

    // WhatsApp ahora suele dar el ID del participante como "xxxxx@lid" (un
    // identificador de privacidad) en vez del numero real "xxxxx@s.whatsapp.net".
    // Antes, si no se lograba traducir el @lid a un numero real, se terminaba
    // usando el propio @lid como si fuera un numero de telefono -- por eso
    // salian "numeros random" en las menciones. Ahora: el JID que se usa para
    // ETIQUETAR (mentions) siempre es el que WhatsApp realmente entrego
    // (participanteId, sea @lid o @s.whatsapp.net), que es 100% valido porque
    // es el identificador real de esa persona en el grupo. La traduccion a
    // numero de telefono SOLO se usa para el texto visible, y si falla, no
    // rompe nada -- simplemente el texto no muestra el numero.
    async function resolverParticipante(participanteId, metadata, sock) {
      if (participanteId.endsWith('@s.whatsapp.net')) {
        return { numero: participanteId.split('@')[0], jidMencion: participanteId };
      }

      try {
        const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(participanteId);
        if (pn) {
          const numeroReal = pn.split('@')[0].split(':')[0];
          return { numero: numeroReal, jidMencion: `${numeroReal}@s.whatsapp.net` };
        }
      } catch (err) { /* este fork no soporta el mapeo, seguimos con el respaldo */ }

      const info = metadata.participants.find(p => p.id === participanteId || p.lid === participanteId);
      if (info?.phoneNumber) {
        const numeroReal = info.phoneNumber.split('@')[0];
        return { numero: numeroReal, jidMencion: `${numeroReal}@s.whatsapp.net` };
      }

      return { numero: `lid-${participanteId.split('@')[0]}`, jidMencion: participanteId };
    }

    async function procesarParticipante(participante) {
      const participanteId = typeof participante === 'string' ? participante : participante.id;
      const { numero, jidMencion } = await resolverParticipante(participanteId, metadata, sock);
      const jidReal = jidMencion;

      if (action === 'add' && grupo.antifake && !numero.startsWith('lid-')) {
        const codigos = grupo.paisesPermitidos || ['52', '51'];
        const permitido = codigos.some(c => numero.startsWith(c));
        if (!permitido) {
          try {
            await sock.groupParticipantsUpdate(jid, [participanteId], 'remove');
            await sock.sendMessage(jid, {
              text: `🚫 @${numero} fue expulsado por antifake (numero de un pais no permitido).`,
              mentions: [jidReal]
            });
            return;
          } catch (err) { console.error(err); }
        }
      }

      if (action === 'add' && grupo.antiraid) {
        global.controlRaid = global.controlRaid || {};
        const registro = global.controlRaid[jid] || [];
        const ahora = Date.now();
        const reciente = registro.filter(t => ahora - t < 30000);
        reciente.push(ahora);
        global.controlRaid[jid] = reciente;
        if (reciente.length > 5) {
          try {
            await sock.groupSettingUpdate(jid, 'announcement');
            await sock.sendMessage(jid, { text: '🚨 Posible raid detectado (muchos usuarios entrando de golpe). El grupo fue cerrado automaticamente, solo admins pueden escribir.' });
          } catch (err) { console.error(err); }
        }
      }

      if (action === 'add' && grupo.bienvenida) {
        const nombreConocido = getUsuario(db, jidReal).nombre;
        const plantilla = grupo.textoBienvenida || 'Bienvenido/a {user} al grupo {group}!';
        const texto = construirTexto(plantilla, { numero, metadata, sock, prefix: config.prefix, nombreConocido });
        const fotoBuffer = grupo.welcomeMediaType === undefined ? await obtenerFotoPerfilSegura(sock, participanteId) : null;
        const { buffer, tipoMedia } = await obtenerMediaGuardada('welcome', jid, grupo, {
          fotoBuffer, nombreGrupo: metadata.subject, totalMiembros: metadata.participants.length, numero, nombreConocido
        });
        const payload = construirPayloadEnvio(tipoMedia, buffer, texto);
        await sock.sendMessage(jid, { ...payload, mentions: [jidReal] });
      }

      if (action === 'remove' && grupo.despedida) {
        const nombreConocido = getUsuario(db, jidReal).nombre;
        const plantilla = grupo.textoDespedida || '{user} salio del grupo.';
        const texto = construirTexto(plantilla, { numero, metadata, sock, prefix: config.prefix, nombreConocido });
        const fotoBuffer = grupo.byeMediaType === undefined ? await obtenerFotoPerfilSegura(sock, participanteId) : null;
        const { buffer, tipoMedia } = await obtenerMediaGuardada('bye', jid, grupo, {
          fotoBuffer, nombreGrupo: metadata.subject, totalMiembros: metadata.participants.length, numero, nombreConocido
        });
        const payload = construirPayloadEnvio(tipoMedia, buffer, texto);
        await sock.sendMessage(jid, { ...payload, mentions: [jidReal] });
      }
    }

    await Promise.all(participants.map(procesarParticipante));
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const config = leerConfig();
    const jid = msg.key.remoteJid;
    const texto = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      ''
    ).trim();
    const esGrupo = jid.endsWith('@g.us');

    if (esGrupo && config.grupoPelis && jid === config.grupoPelis && msg.message.videoMessage) {
      try {
        const vm = msg.message.videoMessage;
        if (!vm.mimetype || vm.mimetype.startsWith('video/')) {
          const { agregarPelicula } = require('./lib/pelis');
          const { caja: cajaPelis } = require('./lib/estilo');
          const dbPelis = leerDB();
          const grupoPelisPrefix = getGrupo(dbPelis, jid);
          const prefixPelis = grupoPelisPrefix.prefix || config.prefix || '.';
          const nombreArchivo = vm.fileName || `video_${Date.now()}.mp4`;
          const numero = agregarPelicula({
            nombre: nombreArchivo, mimetype: vm.mimetype, tamano: Number(vm.fileLength) || 0,
            key: msg.key, videoMessage: vm
          });
          await sock.sendMessage(jid, {
            text: cajaPelis([`*${nombreArchivo}*`, `Pidanla con: ${prefixPelis}pelis ${numero}`], { titulo: `🎬 AGREGADA AL CATALOGO #${numero}`, estilo: 'gamer' })
          }, { quoted: msg });
        }
      } catch (e) { console.error('[pelis] error catalogando video:', e); }
    }

    if (texto) {
      const nombreRemitente = msg.pushName || (msg.key.participant || jid).split('@')[0];
      logMensaje({ remitente: nombreRemitente, texto, esGrupo });
    }

    if (msg.pushName) {
      const idCrudo = msg.key.participantPn || msg.key.participant || jid;
      const idRemitente = `${idCrudo.split('@')[0]}@s.whatsapp.net`;
      const dbNombre = leerDB();
      const usuarioNombre = getUsuario(dbNombre, idRemitente);
      if (usuarioNombre.nombre !== msg.pushName) {
        usuarioNombre.nombre = msg.pushName;
        const { guardarDB } = require('./lib/db');
        guardarDB(dbNombre);
      }
    }

    if (config.soloOwner) {
      const esOwnerCheckPrivado = await esOwnerBot(sock, config, msg);
      if (!esOwnerCheckPrivado) return;
    }

    let prefix = config.prefix || '.';
    if (esGrupo) {
      const db = leerDB();
      const grupo = getGrupo(db, jid);
      if (grupo.prefix) prefix = grupo.prefix;
    }

    const { propuestasPorMensaje, limpiarExpiradas } = require('./lib/matrimonio');
    limpiarExpiradas();
    const stanzaIdRespuesta = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (stanzaIdRespuesta && propuestasPorMensaje.has(stanzaIdRespuesta)) {
      const propuesta = propuestasPorMensaje.get(stanzaIdRespuesta);
      const remitenteRespuesta = msg.key.participant || msg.key.remoteJid;
      if (remitenteRespuesta.split('@')[0] === propuesta.para.split('@')[0]) {
        const respuestaTexto = texto.trim().toLowerCase();
        if (respuestaTexto === 'si' || respuestaTexto === 'sí') {
          propuestasPorMensaje.delete(stanzaIdRespuesta);
          const { guardarDB } = require('./lib/db');
          const dbCasar = leerDB();
          const perfilDe = getUsuario(dbCasar, propuesta.de);
          const perfilPara = getUsuario(dbCasar, propuesta.para);
          if (perfilDe.pareja || perfilPara.pareja) {
            await sock.sendMessage(propuesta.jid, { text: 'Una de las dos personas ya esta casada, la propuesta ya no es valida.' });
          } else {
            perfilDe.pareja = propuesta.para;
            perfilPara.pareja = propuesta.de;
            guardarDB(dbCasar);
            await sock.sendMessage(propuesta.jid, {
              text: `💒 @${propuesta.de.split('@')[0]} y @${propuesta.para.split('@')[0]} ahora estan casados! Felicidades 🎉`,
              mentions: [propuesta.de, propuesta.para]
            });
          }
          return;
        }
        if (respuestaTexto === 'no') {
          propuestasPorMensaje.delete(stanzaIdRespuesta);
          await sock.sendMessage(propuesta.jid, {
            text: `💔 @${propuesta.para.split('@')[0]} rechazo la propuesta de @${propuesta.de.split('@')[0]}.`,
            mentions: [propuesta.de, propuesta.para]
          });
          return;
        }
      }
    }

    const botonId = msg.message?.templateButtonReplyMessage?.selectedId;
    if (botonId && botonId.includes('|')) {
      const [comandoBoton, urlBoton] = botonId.split('|');
      const comandoEncontrado = comandos.get(normalizarComando(comandoBoton));
      if (comandoEncontrado) {
        const textoFalso = `${prefix}${comandoBoton} ${urlBoton}`;
        try {
          await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } });
          await comandoEncontrado.execute(sock, jid, msg, { prefix, texto: textoFalso, comandos });
        } catch (err) {
          console.error(err);
          await sock.sendMessage(jid, { text: 'Ocurrio un error al procesar la descarga.' });
        }
      }
      return;
    }

    let idSeleccionado = null;
    const nativeFlowRaw = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (nativeFlowRaw) {
      try {
        const seleccion = JSON.parse(nativeFlowRaw);
        idSeleccionado = seleccion?.id || null;
      } catch (e) {}
    }
    if (!idSeleccionado) idSeleccionado = msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || null;
    if (!idSeleccionado) idSeleccionado = msg.message?.buttonsResponseMessage?.selectedButtonId || null;
    if (!idSeleccionado) {
      const selectedIdDirecto = msg.message?.templateButtonReplyMessage?.selectedId;
      if (selectedIdDirecto && !selectedIdDirecto.includes('|')) idSeleccionado = selectedIdDirecto;
    }

    if (idSeleccionado && idSeleccionado.startsWith(prefix)) {
      const argsSel = idSeleccionado.slice(prefix.length).trim().split(/\s+/);
      const nombreComandoSel = argsSel[0];
      const comandoSel = comandos.get(normalizarComando(nombreComandoSel));
      if (comandoSel) {
        try {
          await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } });
          await comandoSel.execute(sock, jid, msg, { prefix, texto: idSeleccionado, comandos });
        } catch (err) {
          console.error(err);
          await sock.sendMessage(jid, { text: 'Ocurrio un error al procesar la seleccion.' });
        }
      }
      return;
    }

    if (esGrupo) {
      const { guardarDB } = require('./lib/db');
      const { caja } = require('./lib/estilo');
      const db = leerDB();
      const remitente = msg.key.participant;
      const usuario = getUsuario(db, remitente);
      const grupo = getGrupo(db, jid);

      if (!grupo.actividad) grupo.actividad = {};
      if (!grupo.mensajes) grupo.mensajes = {};
      grupo.actividad[remitente] = Date.now();
      grupo.mensajes[remitente] = (grupo.mensajes[remitente] || 0) + 1;
      guardarDB(db);

      if (usuario.muteado) {
        await sock.sendMessage(jid, { delete: msg.key });
        return;
      }

      if (grupo.antiflood || grupo.antispam) {
        global.controlFlood = global.controlFlood || {};
        const clave = `${jid}-${remitente}`;
        const ahora = Date.now();
        const registro = global.controlFlood[clave] || { mensajes: [], ultimoTexto: null, repeticiones: 0 };

        if (grupo.antiflood) {
          registro.mensajes = registro.mensajes.filter(t => ahora - t < 10000);
          registro.mensajes.push(ahora);
          if (registro.mensajes.length > 6) {
            const { esAdminDelGrupo } = require('./lib/permisos');
            const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
            if (!esAdmin) {
              usuario.muteado = true;
              guardarDB(db);
              await sock.sendMessage(jid, {
                text: `🚫 @${remitente.split('@')[0]} fue silenciado por flood (mensajes muy seguidos).`,
                mentions: [remitente]
              });
              global.controlFlood[clave] = registro;
              return;
            }
          }
        }

        if (grupo.antispam && texto) {
          if (registro.ultimoTexto === texto) {
            registro.repeticiones++;
          } else {
            registro.repeticiones = 0;
            registro.ultimoTexto = texto;
          }
          if (registro.repeticiones >= 3) {
            await sock.sendMessage(jid, { delete: msg.key });
            global.controlFlood[clave] = registro;
            return;
          }
        }
        global.controlFlood[clave] = registro;
      }

      const tieneLink = /(https?:\/\/|www\.)\S+/i.test(texto);
      if (grupo.antilink && tieneLink) {
        const metadata = await sock.groupMetadata(jid);
        const esAdmin = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente)?.admin;
        if (!esAdmin) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, { text: 'Enlace eliminado. El antilink esta activado.' });
          return;
        }
      }

      if (texto && grupo.simonAutomatico) {
        const { registrarMensaje, evaluarIntervencionSimon } = require('./lib/simonWatcher');
        const nombreParaSimon = msg.pushName || remitente.split('@')[0];
        registrarMensaje(jid, nombreParaSimon, texto);
        evaluarIntervencionSimon(sock, jid).catch(err => {
          console.error('Fallo el watcher de Simon:', err);
        });
      }
    }

    const { obtenerJuego, terminarJuego } = require('./lib/juegos');
    const juegoActivo = obtenerJuego(jid);
    if (juegoActivo && texto && !texto.startsWith(prefix)) {
      try {
        await juegoActivo.manejarRespuesta(sock, jid, msg, texto);
      } catch (err) {
        console.error(err);
        terminarJuego(jid);
      }
      return;
    }

    if (!texto.startsWith(prefix)) return;

    const args = texto.slice(prefix.length).trim().split(/\s+/);
    const nombreComando = args[0];
    const comando = comandos.get(normalizarComando(nombreComando));

    if (!comando) return;

    if (comando.groupOnly && !esGrupo) {
      return sock.sendMessage(jid, { text: 'Este comando solo funciona dentro de un grupo.' });
    }

    if (esGrupo) {
      const dbCheck = leerDB();
      const grupoCheck = getGrupo(dbCheck, jid);
      const remitenteCheck = msg.key.participant;
      const esOwnerCheck = await esOwnerBot(sock, config, msg);

      let metadataCheck = null;
      let esAdminCheck = false;

      if (grupoCheck.soloAdmins || (grupoCheck.permisosCategorias && Object.keys(grupoCheck.permisosCategorias).length)) {
        metadataCheck = await sock.groupMetadata(jid);
        let remitenteResuelto = remitenteCheck;
        try {
          const [info] = await sock.onWhatsApp(remitenteCheck);
          if (info?.lid) remitenteResuelto = info.lid;
        } catch (e) {}
        const remitenteNum = remitenteResuelto.split("@")[0];
        esAdminCheck = metadataCheck.participants.find(p => {
          const pId = (p.id || "").split("@")[0];
          const pPhone = (p.phoneNumber || "").split("@")[0];
          return pId === remitenteNum || pPhone === remitenteNum || pId === remitenteCheck.split("@")[0];
        })?.admin;
      }

      if (grupoCheck.soloAdmins && !esAdminCheck && !esOwnerCheck) return;

      const categoriaComando = comando.category || 'general';
      const permisoCategoria = grupoCheck.permisosCategorias?.[categoriaComando];

      if (permisoCategoria === 'admins' && !esAdminCheck && !esOwnerCheck) {
        return sock.sendMessage(jid, { text: `Los comandos de la categoria *${categoriaComando}* solo pueden ser usados por admins.` });
      }
    }

    if (esGrupo && comando.category === 'nsfw') {
      const dbNsfw = leerDB();
      const grupoNsfw = getGrupo(dbNsfw, jid);
      if (!grupoNsfw.nsfw) {
        return sock.sendMessage(jid, { text: `Los comandos NSFW estan desactivados en este grupo.\nUsa *${prefix}nsfw on* para activarlos.` }, { quoted: msg });
      }
    }

    try {
      const emojiCategoria = EMOJIS_POR_CATEGORIA[comando.category] || EMOJIS_POR_CATEGORIA.default;
      await sock.sendMessage(jid, { react: { text: emojiCategoria, key: msg.key } });
      await comando.execute(sock, jid, msg, { prefix, texto, comandos });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al ejecutar el comando.' });
    }
  });
}

startBot();

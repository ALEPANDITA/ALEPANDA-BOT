const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('fsociety-Baileys');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const readline = require('readline');
const pino = require('pino');

const { leerConfig } = require('./lib/config');

const fs = require('fs');
const path = require('path');

function cargarComandos() {
  const comandos = new Map();
  const basePath = path.join(__dirname, 'commands');
  const categorias = fs.readdirSync(basePath);

  for (const categoria of categorias) {
    const catPath = path.join(basePath, categoria);
    const archivos = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));
    for (const archivo of archivos) {
      const exportado = require(path.join(catPath, archivo));
      const lista = Array.isArray(exportado) ? exportado : [exportado];
      for (const comando of lista) {
        comandos.set(comando.name, comando);
      }
    }
  }
  return comandos;
}

const comandos = cargarComandos();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pregunta = (texto) => new Promise((resolve) => rl.question(texto, resolve));

function mostrarBanner() {
  console.clear();
  const texto = figlet.textSync('ALEPANDA', { font: 'Standard' });
  console.log(gradient.pastel.multiline(texto));
  console.log(gradient.cristal('made with love by ALEPANDITA'));
  console.log('');
}

process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Promesa rechazada sin manejar:', err?.message || err);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  mostrarBanner();

  let metodo = null;
  const yaRegistrado = fs.existsSync(path.join(__dirname, 'auth_info', 'creds.json'));

  if (!yaRegistrado) {
    console.log('Seleccione una opcion:');
    console.log('1. Con codigo QR');
    console.log('2. Con codigo de texto de 8 digitos');
    metodo = await pregunta('> ');
  }

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  });

  if (!sock.authState.creds.registered) {
    if (metodo?.trim() === '1') {
      sock.ev.on('connection.update', (update) => {
        if (update.qr) {
          console.clear();
          mostrarBanner();
          qrcode.generate(update.qr, { small: true });
          console.log('Escanea este codigo QR desde WhatsApp > Dispositivos vinculados');
        }
      });
    } else {
      const numero = await pregunta('Escribe tu numero con codigo de pais (ej: 5491122334455): ');
      await new Promise(resolve => setTimeout(resolve, 3000));
      const codigo = await sock.requestPairingCode(numero.trim());
      console.log(`Tu codigo de vinculacion es: ${codigo}`);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) startBot();
      else console.log('Sesion cerrada, borra la carpeta auth_info y vuelve a intentar.');
    } else if (connection === 'open') {
      console.log(chalk.green.bold('✅ Bot conectado correctamente'));
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('group-participants.update', async (update) => {
    const { id: jid, participants, action } = update;
    const { leerDB, getGrupo } = require('./lib/db');

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (err) {
      return;
    }

    for (const participante of participants) {
      const participanteId = typeof participante === 'string' ? participante : participante.id;
      const numero = participanteId.split('@')[0];

      if (action === 'add' && grupo.bienvenida) {
        let texto = grupo.textoBienvenida || 'Bienvenido/a {user} al grupo {group}!';
        texto = texto.replace('{user}', `@${numero}`).replace('{group}', metadata.subject);

        if (grupo.usarDescripcion && metadata.desc) {
          texto += `\n\n📋 *Descripcion del grupo:*\n${metadata.desc}`;
        }

        const imgPath = path.join(__dirname, 'assets', 'bienvenida', `${jid.replace('@g.us', '')}.jpg`);
        if (fs.existsSync(imgPath)) {
          const buffer = fs.readFileSync(imgPath);
          await sock.sendMessage(jid, { image: buffer, caption: texto, mentions: [participanteId] });
        } else {
          await sock.sendMessage(jid, { text: texto, mentions: [participanteId] });
        }
      }

      if (action === 'remove' && grupo.despedida) {
        let texto = grupo.textoDespedida || '{user} salio del grupo.';
        texto = texto.replace('{user}', `@${numero}`).replace('{group}', metadata.subject);

        const imgPath = path.join(__dirname, 'assets', 'despedida', `${jid.replace('@g.us', '')}.jpg`);
        if (fs.existsSync(imgPath)) {
          const buffer = fs.readFileSync(imgPath);
          await sock.sendMessage(jid, { image: buffer, caption: texto, mentions: [participanteId] });
        } else {
          await sock.sendMessage(jid, { text: texto, mentions: [participanteId] });
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    console.log('MENSAJE RECIBIDO, total:', messages.length);
    const msg = messages[0];
    console.log('PASO 1: msg.message existe?', !!msg?.message, 'fromMe?', msg?.key?.fromMe);
    if (!msg.message || msg.key.fromMe) return;

    const config = leerConfig();

    const jid = msg.key.remoteJid;
    const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    const esGrupo = jid.endsWith('@g.us');

    let prefix = config.prefix || '.';
    if (esGrupo) {
      const { leerDB: leerDBPrefix, getGrupo: getGrupoPrefix } = require('./lib/db');
      const dbPrefix = leerDBPrefix();
      const grupoPrefix = getGrupoPrefix(dbPrefix, jid);
      if (grupoPrefix.prefix) prefix = grupoPrefix.prefix;
    }

    const botonId = msg.message?.templateButtonReplyMessage?.selectedId;
    if (botonId && botonId.includes('|')) {
      const [comandoBoton, urlBoton] = botonId.split('|');
      const comandoEncontrado = comandos.get(comandoBoton);
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

    if (esGrupo) {
      const { leerDB, guardarDB, getUsuario, getGrupo } = require('./lib/db');
      const { darXp } = require('./lib/niveles');
      const db = leerDB();
      const remitente = msg.key.participant;
      const usuario = getUsuario(db, remitente);
      const grupo = getGrupo(db, jid);

      if (!grupo.actividad) grupo.actividad = {};
      if (!grupo.mensajes) grupo.mensajes = {};
      grupo.actividad[remitente] = Date.now();
      grupo.mensajes[remitente] = (grupo.mensajes[remitente] || 0) + 1;

      const resultado = grupo.niveles ? darXp(usuario) : null;
      guardarDB(db);

      if (resultado?.subioNivel) {
        await sock.sendMessage(jid, {
          text: `🎉 @${remitente.split('@')[0]} subio al nivel *${resultado.nivelNuevo}*!`,
          mentions: [remitente]
        });
      }

      if (usuario.muteado) {
        await sock.sendMessage(jid, { delete: msg.key });
        return;
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
    }

    console.log('DEBUG texto:', JSON.stringify(texto), 'prefix:', JSON.stringify(prefix), 'startsWith?', texto.startsWith(prefix));
    if (!texto.startsWith(prefix)) return;

    const args = texto.slice(prefix.length).trim().split(/\s+/);
    const nombreComando = args[0];
    const comando = comandos.get(nombreComando);

    if (!comando) return;

    if (comando.groupOnly && !esGrupo) {
      return sock.sendMessage(jid, { text: 'Este comando solo funciona dentro de un grupo.' });
    }

    if (esGrupo) {
      const { leerDB, getGrupo } = require('./lib/db');
      const dbCheck = leerDB();
      const grupoCheck = getGrupo(dbCheck, jid);
      const remitenteCheck = msg.key.participant;
      const esOwnerCheck = config.owners && config.owners.includes(remitenteCheck);

      let metadataCheck = null;
      let esAdminCheck = false;

      if (grupoCheck.soloAdmins || (grupoCheck.permisosCategorias && Object.keys(grupoCheck.permisosCategorias).length)) {
        metadataCheck = await sock.groupMetadata(jid);
          console.log("DEBUG PARTICIPANTS:", JSON.stringify(metadataCheck.participants.map(p => ({ id: p.id, phoneNumber: p.phoneNumber, admin: p.admin }))));
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

      console.log('DEBUG MSG KEY:', JSON.stringify(msg.key));
      console.log('DEBUG PERMISOS -> remitente:', remitenteCheck, '| esAdminCheck:', esAdminCheck, '| esOwnerCheck:', esOwnerCheck, '| soloAdmins:', grupoCheck.soloAdmins);
      if (grupoCheck.soloAdmins && !esAdminCheck && !esOwnerCheck) {
        return;
      }

      const categoriaComando = comando.category || 'general';
      const permisoCategoria = grupoCheck.permisosCategorias?.[categoriaComando];

      if (permisoCategoria === 'admins' && !esAdminCheck && !esOwnerCheck) {
        return sock.sendMessage(jid, {
          text: `Los comandos de la categoria *${categoriaComando}* solo pueden ser usados por admins.`
        });
      }
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } });
      await comando.execute(sock, jid, msg, { prefix, texto, comandos });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al ejecutar el comando.' });
    }
  });
}

startBot();

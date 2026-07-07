const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

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
    const fs = require('fs');
    const path = require('path');

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (err) {
      return;
    }

    for (const participante of participants) {
      const numero = participante.split('@')[0];

      if (action === 'add' && grupo.bienvenida) {
        let texto = grupo.textoBienvenida || 'Bienvenido/a {user} al grupo {group}!';
        texto = texto.replace('{user}', `@${numero}`).replace('{group}', metadata.subject);

        if (grupo.usarDescripcion && metadata.desc) {
          texto += `\n\n📋 *Descripcion del grupo:*\n${metadata.desc}`;
        }

        const imgPath = path.join(__dirname, 'assets', 'bienvenida', `${jid.replace('@g.us', '')}.jpg`);
        if (fs.existsSync(imgPath)) {
          const buffer = fs.readFileSync(imgPath);
          await sock.sendMessage(jid, { image: buffer, caption: texto, mentions: [participante] });
        } else {
          await sock.sendMessage(jid, { text: texto, mentions: [participante] });
        }
      }

      if (action === 'remove' && grupo.despedida) {
        let texto = grupo.textoDespedida || '{user} salio del grupo.';
        texto = texto.replace('{user}', `@${numero}`).replace('{group}', metadata.subject);

        const imgPath = path.join(__dirname, 'assets', 'despedida', `${jid.replace('@g.us', '')}.jpg`);
        if (fs.existsSync(imgPath)) {
          const buffer = fs.readFileSync(imgPath);
          await sock.sendMessage(jid, { image: buffer, caption: texto, mentions: [participante] });
        } else {
          await sock.sendMessage(jid, { text: texto, mentions: [participante] });
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const config = leerConfig();
    const prefix = config.prefix || '.';

    const jid = msg.key.remoteJid;
    const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    const esGrupo = jid.endsWith('@g.us');

    if (esGrupo) {
      const { leerDB, guardarDB, getUsuario, getGrupo } = require('./lib/db');
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

    if (!texto.startsWith(prefix)) return;

    const args = texto.slice(prefix.length).trim().split(/\s+/);
    const nombreComando = args[0];
    const comando = comandos.get(nombreComando);

    if (!comando) return;

    if (comando.groupOnly && !esGrupo) {
      return sock.sendMessage(jid, { text: 'Este comando solo funciona dentro de un grupo.' });
    }

    try {
      await comando.execute(sock, jid, msg, { prefix, texto, comandos });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(jid, { text: 'Ocurrio un error al ejecutar el comando.' });
    }
  });
}

startBot();

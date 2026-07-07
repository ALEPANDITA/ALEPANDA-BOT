const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
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

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' })
  });

  if (!sock.authState.creds.registered) {
    const numero = await pregunta('Escribe tu numero con codigo de pais (ej: 5491122334455): ');
    const codigo = await sock.requestPairingCode(numero.trim());
    console.log(`Tu codigo de vinculacion es: ${codigo}`);
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

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const config = leerConfig();
    const prefix = config.prefix || '.';

    const jid = msg.key.remoteJid;
    const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    const esGrupo = jid.endsWith('@g.us');

    // Revisar mute, antilink y registrar actividad antes de procesar comandos
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

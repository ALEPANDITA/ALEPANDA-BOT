const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile } = require('child_process');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');

const CARPETA_COMANDOS = path.join(__dirname, '..', '..', 'commands');
const CARPETA_STAGING = path.join(CARPETA_COMANDOS, '_staging');
const RUTA_RUNNER = path.join(__dirname, '..', '..', 'lib', 'addcmd-runner.js');

function sanitizar(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '');
}

function validarEnProcesoAparte(rutaArchivo) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [RUTA_RUNNER, rutaArchivo],
      { timeout: 8000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          return resolve({ ok: false, error: 'El archivo tardo demasiado en cargar (posible bucle infinito o proceso colgado). No se instalo.' });
        }
        try {
          resolve(JSON.parse(String(stdout || '').trim()));
        } catch (e) {
          resolve({ ok: false, error: String(stderr || (err && err.message) || 'No se pudo validar el archivo.').slice(0, 3500) });
        }
      }
    );
  });
}

module.exports = {
  name: 'addcmd',
  aliases: ['nuevocmd', 'instalarcmd'],
  category: 'owner',
  description: 'Instala un comando nuevo desde un archivo .js adjunto, valida que funcione y lo activa sin reiniciar (solo owner)',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const forzar = /\b(forzar|force)\b/i.test(texto || '');

    const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const docCitado = citado?.documentMessage
      ? { message: citado }
      : msg.message.documentMessage
        ? msg
        : null;

    if (!docCitado) {
      return sock.sendMessage(jid, {
        text: advertencia(
          `Envia un archivo .js como documento (o responde a uno) con:\n${prefix}addcmd\n\nAgrega "forzar" al final para sobreescribir un comando existente, ej:\n${prefix}addcmd forzar`,
          { titulo: 'FALTA EL ARCHIVO', estilo: 'neon' }
        )
      });
    }

    const nombreArchivoOriginal = docCitado.message.documentMessage?.fileName || 'comando.js';
    if (!nombreArchivoOriginal.toLowerCase().endsWith('.js')) {
      return sock.sendMessage(jid, { text: advertencia('El archivo debe ser un .js', { titulo: 'ARCHIVO INVALIDO', estilo: 'neon' }) });
    }

    await sock.sendMessage(jid, { text: '⏳ Descargando y validando el comando...' }, { quoted: msg });

    let buffer;
    try {
      buffer = await downloadMediaMessage(docCitado, 'buffer', {});
    } catch (err) {
      console.error('[addcmd] error descargando adjunto:', err);
      return sock.sendMessage(jid, { text: cajaError('No se pudo descargar el archivo adjunto.') });
    }

    const codigo = buffer.toString('utf8');

    try {
      new vm.Script(codigo, { filename: nombreArchivoOriginal });
    } catch (err) {
      return sock.sendMessage(jid, {
        text: caja([String(err.message || err).slice(0, 3500)], { titulo: 'ERROR DE SINTAXIS', estilo: 'neon' })
      });
    }

    if (!fs.existsSync(CARPETA_STAGING)) fs.mkdirSync(CARPETA_STAGING, { recursive: true });
    const rutaStaging = path.join(CARPETA_STAGING, `staging_${Date.now()}_${sanitizar(nombreArchivoOriginal)}`);
    fs.writeFileSync(rutaStaging, codigo);

    const resultado = await validarEnProcesoAparte(rutaStaging);

    if (!resultado.ok) {
      fs.unlinkSync(rutaStaging);
      return sock.sendMessage(jid, {
        text: caja([resultado.error || 'Error desconocido validando el archivo.'], { titulo: 'COMANDO INVALIDO', estilo: 'neon' })
      });
    }

    const listaComandos = resultado.comandos;
    const categoria = sanitizar(listaComandos[0].category) || 'general';
    const carpetaDestino = path.join(CARPETA_COMANDOS, categoria);
    const carpetaNueva = !fs.existsSync(carpetaDestino);
    if (carpetaNueva) fs.mkdirSync(carpetaDestino, { recursive: true });

    const nombreBase = sanitizar(listaComandos[0].name) || sanitizar(path.basename(nombreArchivoOriginal, '.js')) || `cmd_${Date.now()}`;
    const rutaDestino = path.join(carpetaDestino, `${nombreBase}.js`);

    if (fs.existsSync(rutaDestino) && !forzar) {
      fs.unlinkSync(rutaStaging);
      return sock.sendMessage(jid, {
        text: advertencia(
          `Ya existe un comando llamado "${nombreBase}" en la categoria "${categoria}".\nSi quieres reemplazarlo, envia de nuevo agregando "forzar", ej:\n${prefix}addcmd forzar`,
          { titulo: 'YA EXISTE', estilo: 'neon' }
        )
      });
    }

    fs.renameSync(rutaStaging, rutaDestino);

    let modulo;
    try {
      delete require.cache[require.resolve(rutaDestino)];
      modulo = require(rutaDestino);
    } catch (err) {
      fs.unlinkSync(rutaDestino);
      console.error('[addcmd] error cargando el comando ya instalado:', err);
      return sock.sendMessage(jid, {
        text: caja([String(err.stack || err).slice(0, 3500)], { titulo: 'ERROR AL CARGAR', estilo: 'neon' })
      });
    }

    const comandosNuevos = Array.isArray(modulo) ? modulo : [modulo];
    const resumen = [];
    for (const cmd of comandosNuevos) {
      if (!cmd?.name || typeof cmd.execute !== 'function') continue;
      cmd._rutaArchivo = rutaDestino;
      comandos.set(cmd.name, cmd);
      if (Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) comandos.set(alias, cmd);
      }
      const aliasTxt = cmd.aliases?.length ? ` _(${cmd.aliases.map((a) => prefix + a).join(', ')})_` : '';
      resumen.push(`${prefix}${cmd.name}${aliasTxt} — ${cmd.description || 'sin descripcion'}`);
    }

    if (!resumen.length) {
      fs.unlinkSync(rutaDestino);
      return sock.sendMessage(jid, { text: cajaError('El archivo se cargo pero no contenia ningun comando valido.') });
    }

    await sock.sendMessage(jid, {
      text: exito(
        `Instalado y activo YA, sin reiniciar el bot.\n\n` +
        `Categoria: *${categoria}*${carpetaNueva ? ' _(nueva, se creo la carpeta)_' : ''}\n` +
        `Archivo: commands/${categoria}/${path.basename(rutaDestino)}\n\n` +
        `${resumen.join('\n')}\n\n` +
        `Ya deberia aparecer en ${prefix}menu.`,
        { titulo: 'ADDCMD', estilo: 'neon' }
      )
    });
  }
};

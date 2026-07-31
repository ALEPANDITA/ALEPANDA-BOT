const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');
const { generarTexto } = require('../../lib/gemini');
const { construirPromptArreglo, limpiarCodigo } = require('../../lib/crearcmd-ia');
const { guardarEstado } = require('../../lib/crearcmd-estado');

const CARPETA_COMANDOS = path.join(__dirname, '..', '..', 'commands');
const CARPETA_STAGING = path.join(CARPETA_COMANDOS, '_staging');
const RUTA_RUNNER = path.join(__dirname, '..', '..', 'lib', 'addcmd-runner.js');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function validarEnProcesoAparte(rutaArchivo) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [RUTA_RUNNER, rutaArchivo],
      { timeout: 8000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          return resolve({ ok: false, error: 'El archivo tardo demasiado en cargar (posible bucle infinito o proceso colgado). No se toco el original.' });
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
  name: 'arreglarcmd',
  aliases: ['repararcmd', 'fixcmd'],
  category: 'owner',
  description: 'Repara un comando YA EXISTENTE (lo haya creado crearcmd o no) usando IA + tu descripcion del problema. Uso: .arreglarcmd <nombre> <que esta mal>. Solo owner.',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const partes = texto.trim().split(/\s+/);
    const nombrePedido = partes[1];
    const descripcionProblema = partes.slice(2).join(' ').trim();

    if (!nombrePedido || !descripcionProblema) {
      return sock.sendMessage(jid, {
        text: caja(
          [
            `Uso: ${prefix}arreglarcmd <nombre del comando> <que esta mal, incluye el endpoint si cambio>`,
            '',
            `Ejemplo: ${prefix}arreglarcmd pindl ya no descarga, el endpoint ahora responde asi: {"link":"..."}`
          ],
          { titulo: 'ARREGLARCMD', estilo: 'neon' }
        )
      });
    }

    const comando = comandos.get(normalizar(nombrePedido));

    if (!comando) {
      return sock.sendMessage(jid, {
        text: advertencia(`No encontre ningun comando llamado "${nombrePedido}". Usa ${prefix}cmd para ver la lista completa.`, { titulo: 'NO EXISTE', estilo: 'neon' })
      });
    }

    if (!comando._rutaArchivo || !fs.existsSync(comando._rutaArchivo)) {
      return sock.sendMessage(jid, {
        text: cajaError('No pude encontrar el archivo fuente de ese comando en disco, no se puede reparar automaticamente.')
      });
    }

    const rutaOriginal = comando._rutaArchivo;
    const codigoActual = fs.readFileSync(rutaOriginal, 'utf-8');

    await sock.sendMessage(jid, { text: `🛠️ Revisando "${comando.name}" con IA...` }, { quoted: msg });

    const prompt = construirPromptArreglo({
      descripcionOriginal: `Comando existente llamado "${comando.name}" (categoria: ${comando.category || 'general'}). Descripcion original: ${comando.description || '(sin descripcion)'}`,
      codigoAnterior: codigoActual,
      errorAnterior: '(el owner reporta el siguiente problema en produccion, no es un error de validacion)',
      aclaracionUsuario: descripcionProblema
    });

    let respuestaIA;
    try {
      respuestaIA = await generarTexto(prompt);
    } catch (err) {
      const msgErr = err.code === 'NO_API_KEY'
        ? 'No hay ninguna API key de IA configurada (Gemini/Groq/OpenRouter). Configura una con .setapikey para poder usar este comando.'
        : `No se pudo generar la correccion: ${err.message}`;
      return sock.sendMessage(jid, { text: cajaError(msgErr) });
    }

    const codigoNuevo = limpiarCodigo(respuestaIA);

    if (!codigoNuevo) {
      return sock.sendMessage(jid, { text: cajaError('La IA no devolvio ningun codigo utilizable. Intenta describir el problema con mas detalle.') });
    }

    if (!fs.existsSync(CARPETA_STAGING)) fs.mkdirSync(CARPETA_STAGING, { recursive: true });
    const rutaStaging = path.join(CARPETA_STAGING, `fix_${Date.now()}.js`);
    fs.writeFileSync(rutaStaging, codigoNuevo);

    const resultado = await validarEnProcesoAparte(rutaStaging);

    if (!resultado.ok) {
      fs.unlinkSync(rutaStaging);
      guardarEstado(jid, {
        estado: 'fallo',
        descripcionOriginal: `Reparacion de "${comando.name}": ${descripcionProblema}`,
        codigo: codigoNuevo,
        error: resultado.error,
        nombre: comando.name,
        categoria: comando.category || 'general',
        rutaArchivoFinal: rutaOriginal
      });
      return sock.sendMessage(jid, {
        text: caja(
          [resultado.error || 'Error desconocido validando la correccion.', '', `El original NO se toco. Dime mas detalles con ${prefix}crearcmd <lo que sigue mal> y lo reintento.`],
          { titulo: 'LA CORRECCION FALLO', estilo: 'neon' }
        )
      });
    }

    // Respaldo del archivo original antes de sobreescribir, por si hay que volver atras a mano.
    const rutaRespaldo = `${rutaOriginal}.bak-${Date.now()}`;
    fs.copyFileSync(rutaOriginal, rutaRespaldo);

    fs.copyFileSync(rutaStaging, rutaOriginal);
    fs.unlinkSync(rutaStaging);

    let modulo;
    try {
      delete require.cache[require.resolve(rutaOriginal)];
      modulo = require(rutaOriginal);
    } catch (err) {
      // Revertimos al respaldo si ni siquiera carga.
      fs.copyFileSync(rutaRespaldo, rutaOriginal);
      delete require.cache[require.resolve(rutaOriginal)];
      guardarEstado(jid, {
        estado: 'fallo',
        descripcionOriginal: `Reparacion de "${comando.name}": ${descripcionProblema}`,
        codigo: codigoNuevo,
        error: String(err.stack || err).slice(0, 3500),
        nombre: comando.name,
        categoria: comando.category || 'general',
        rutaArchivoFinal: rutaOriginal
      });
      return sock.sendMessage(jid, {
        text: caja([String(err.stack || err).slice(0, 3500), '', 'Se revirtio al original, no quedo roto. Dime mas detalles y lo reintento.'], { titulo: 'ERROR AL CARGAR LA CORRECCION', estilo: 'neon' })
      });
    }

    const comandosNuevos = Array.isArray(modulo) ? modulo : [modulo];
    const resumen = [];
    for (const cmd of comandosNuevos) {
      if (!cmd?.name || typeof cmd.execute !== 'function') continue;
      cmd._rutaArchivo = rutaOriginal;
      comandos.set(cmd.name, cmd);
      if (Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) comandos.set(alias, cmd);
      }
      resumen.push(`${prefix}${cmd.name} — ${cmd.description || 'sin descripcion'}`);
    }

    if (!resumen.length) {
      fs.copyFileSync(rutaRespaldo, rutaOriginal);
      delete require.cache[require.resolve(rutaOriginal)];
      return sock.sendMessage(jid, { text: cajaError('La correccion se cargo pero no contenia ningun comando valido. Se revirtio al original.') });
    }

    guardarEstado(jid, {
      estado: 'exito',
      descripcionOriginal: `Reparacion de "${comando.name}": ${descripcionProblema}`,
      codigo: codigoNuevo,
      error: null,
      nombre: comando.name,
      categoria: comando.category || 'general',
      rutaArchivoFinal: rutaOriginal
    });

    await sock.sendMessage(jid, {
      text: exito(
        `Reparado y activo YA, sin reiniciar el bot.\n\n` +
        `Archivo: ${path.relative(path.join(__dirname, '../..'), rutaOriginal)}\n` +
        `Respaldo del original: ${path.basename(rutaRespaldo)}\n\n` +
        `${resumen.join('\n')}\n\n` +
        `Si sigue sin funcionar bien, dime que pasa con ${prefix}crearcmd <lo que esta mal> y lo sigo corrigiendo.`,
        { titulo: 'ARREGLARCMD', estilo: 'neon' }
      )
    });
  }
};

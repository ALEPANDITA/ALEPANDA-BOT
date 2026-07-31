const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');
const { generarTexto } = require('../../lib/gemini');
const { construirPromptNuevo, construirPromptArreglo, limpiarCodigo } = require('../../lib/crearcmd-ia');
const { obtenerEstado, guardarEstado, borrarEstado } = require('../../lib/crearcmd-estado');

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
  name: 'crearcmd',
  aliases: ['iacmd', 'generarcmd'],
  category: 'owner',
  description: 'Crea un comando nuevo a partir de una descripcion en texto (usando IA), lo valida, lo instala y lo arregla si falla. Solo owner.',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const argumentos = texto.trim().split(/\s+/).slice(1).join(' ').trim();
    const estadoPrevio = obtenerEstado(jid);

    if (!argumentos) {
      const lineas = [
        `${prefix}crearcmd <descripcion del comando, incluye el endpoint/API, que hace, nombre y categoria si quieres> — crea un comando nuevo`,
        `${prefix}crearcmd nuevo <descripcion> — ignora cualquier intento pendiente y empieza de cero`,
      ];
      if (estadoPrevio) {
        lineas.push('');
        lineas.push(`Tienes un intento ${estadoPrevio.estado === 'fallo' ? 'FALLIDO' : 'instalado'} pendiente: *${estadoPrevio.nombre || '(sin nombre aun)'}*.`);
        lineas.push(`Si me dices que esta mal (ej: "${prefix}crearcmd tal cosa no descarga bien, tira error de link") lo reviso y lo arreglo.`);
      }
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'CREARCMD', estilo: 'neon' }) });
    }

    const forzarNuevo = /^nuevo\b/i.test(argumentos);
    const descripcionUsuario = forzarNuevo ? argumentos.replace(/^nuevo\b/i, '').trim() : argumentos;

    if (forzarNuevo) borrarEstado(jid);
    const estadoParaUsar = forzarNuevo ? null : estadoPrevio;

    if (forzarNuevo && !descripcionUsuario) {
      return sock.sendMessage(jid, { text: advertencia(`Escribe la descripcion despues de "nuevo". Ej: ${prefix}crearcmd nuevo descarga un archivo desde tal endpoint...`) });
    }

    const esArreglo = !!estadoParaUsar;

    await sock.sendMessage(jid, {
      text: esArreglo ? '🛠️ Revisando y corrigiendo el comando anterior...' : '🧠 Redactando el comando con IA...'
    }, { quoted: msg });

    let prompt;
    if (esArreglo) {
      prompt = construirPromptArreglo({
        descripcionOriginal: estadoParaUsar.descripcionOriginal,
        codigoAnterior: estadoParaUsar.codigo,
        errorAnterior: estadoParaUsar.error || '(el owner reporta que no funciona bien, sin error tecnico registrado)',
        aclaracionUsuario: descripcionUsuario
      });
    } else {
      prompt = construirPromptNuevo(descripcionUsuario);
    }

    let respuestaIA;
    try {
      respuestaIA = await generarTexto(prompt);
    } catch (err) {
      const msgErr = err.code === 'NO_API_KEY'
        ? 'No hay ninguna API key de IA configurada (Gemini/Groq/OpenRouter). Configura una con .setapikey para poder usar este comando.'
        : `No se pudo generar el codigo: ${err.message}`;
      return sock.sendMessage(jid, { text: cajaError(msgErr) });
    }

    const codigo = limpiarCodigo(respuestaIA);

    if (!codigo) {
      return sock.sendMessage(jid, { text: cajaError('La IA no devolvio ningun codigo utilizable. Intenta describir el comando con mas detalle.') });
    }

    if (!fs.existsSync(CARPETA_STAGING)) fs.mkdirSync(CARPETA_STAGING, { recursive: true });
    const rutaStaging = path.join(CARPETA_STAGING, `ia_${Date.now()}.js`);
    fs.writeFileSync(rutaStaging, codigo);

    const resultado = await validarEnProcesoAparte(rutaStaging);

    if (!resultado.ok) {
      fs.unlinkSync(rutaStaging);
      guardarEstado(jid, {
        estado: 'fallo',
        descripcionOriginal: esArreglo ? estadoParaUsar.descripcionOriginal : descripcionUsuario,
        codigo,
        error: resultado.error,
        nombre: (estadoParaUsar && estadoParaUsar.nombre) || null,
        categoria: (estadoParaUsar && estadoParaUsar.categoria) || null,
        rutaArchivoFinal: (estadoParaUsar && estadoParaUsar.rutaArchivoFinal) || null
      });
      return sock.sendMessage(jid, {
        text: caja(
          [resultado.error || 'Error desconocido validando el codigo generado.', '', `Dime exactamente que pasa (o que deberia pasar) con ${prefix}crearcmd <lo que esta mal> y lo corrijo.`],
          { titulo: 'NO FUNCIONO, REVISANDO', estilo: 'neon' }
        )
      });
    }

    const listaComandos = resultado.comandos;
    const categoria = sanitizar(listaComandos[0].category) || 'general';
    const nombreBase = sanitizar(listaComandos[0].name) || `iacmd_${Date.now()}`;

    // Si estamos arreglando un intento que YA se habia instalado antes, sobreescribimos ese mismo archivo.
    // Si es nuevo (o el intento previo nunca se instalo), revisamos que no choque con un comando existente.
    let rutaDestino;
    if (esArreglo && estadoParaUsar.rutaArchivoFinal) {
      rutaDestino = estadoParaUsar.rutaArchivoFinal;
    } else {
      const carpetaDestino = path.join(CARPETA_COMANDOS, categoria);
      if (!fs.existsSync(carpetaDestino)) fs.mkdirSync(carpetaDestino, { recursive: true });
      rutaDestino = path.join(carpetaDestino, `${nombreBase}.js`);

      if (fs.existsSync(rutaDestino) && !comandos.get(nombreBase)?._creadoPorIA) {
        fs.unlinkSync(rutaStaging);
        guardarEstado(jid, {
          estado: 'fallo',
          descripcionOriginal: descripcionUsuario,
          codigo,
          error: `Ya existe un comando llamado "${nombreBase}" en la categoria "${categoria}" y no fue creado por ${prefix}crearcmd, asi que no lo voy a sobreescribir solo. Si quieres, dime que le cambie el nombre.`,
          nombre: nombreBase,
          categoria
        });
        return sock.sendMessage(jid, {
          text: advertencia(`Ya existe un comando llamado "${nombreBase}" en la categoria "${categoria}". Dime que le cambie el nombre y lo corrijo.`, { titulo: 'YA EXISTE', estilo: 'neon' })
        });
      }
    }

    fs.copyFileSync(rutaStaging, rutaDestino);
    fs.unlinkSync(rutaStaging);

    let modulo;
    try {
      delete require.cache[require.resolve(rutaDestino)];
      modulo = require(rutaDestino);
    } catch (err) {
      guardarEstado(jid, {
        estado: 'fallo',
        descripcionOriginal: esArreglo ? estadoParaUsar.descripcionOriginal : descripcionUsuario,
        codigo,
        error: String(err.stack || err).slice(0, 3500),
        nombre: nombreBase,
        categoria,
        rutaArchivoFinal: rutaDestino
      });
      return sock.sendMessage(jid, {
        text: caja([String(err.stack || err).slice(0, 3500), '', `Dime ${prefix}crearcmd <lo que pasa> y lo arreglo.`], { titulo: 'ERROR AL CARGAR', estilo: 'neon' })
      });
    }

    const comandosNuevos = Array.isArray(modulo) ? modulo : [modulo];
    const resumen = [];
    for (const cmd of comandosNuevos) {
      if (!cmd?.name || typeof cmd.execute !== 'function') continue;
      cmd._rutaArchivo = rutaDestino;
      cmd._creadoPorIA = true;
      comandos.set(cmd.name, cmd);
      if (Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) comandos.set(alias, cmd);
      }
      const aliasTxt = cmd.aliases?.length ? ` _(${cmd.aliases.map((a) => prefix + a).join(', ')})_` : '';
      resumen.push(`${prefix}${cmd.name}${aliasTxt} — ${cmd.description || 'sin descripcion'}`);
    }

    if (!resumen.length) {
      return sock.sendMessage(jid, { text: cajaError('El codigo se cargo pero no contenia ningun comando valido (falta name o execute).') });
    }

    guardarEstado(jid, {
      estado: 'exito',
      descripcionOriginal: esArreglo ? estadoParaUsar.descripcionOriginal : descripcionUsuario,
      codigo,
      error: null,
      nombre: nombreBase,
      categoria,
      rutaArchivoFinal: rutaDestino
    });

    await sock.sendMessage(jid, {
      text: exito(
        `Instalado y activo YA, sin reiniciar el bot.\n\n` +
        `Categoria: *${categoria}*\n` +
        `Archivo: commands/${categoria}/${path.basename(rutaDestino)}\n\n` +
        `${resumen.join('\n')}\n\n` +
        `Si algo no funciona bien, dime exactamente que pasa con ${prefix}crearcmd <lo que esta mal> y lo corrijo sin que tengas que repetir toda la descripcion.`,
        { titulo: 'CREARCMD', estilo: 'neon' }
      )
    });
  }
};

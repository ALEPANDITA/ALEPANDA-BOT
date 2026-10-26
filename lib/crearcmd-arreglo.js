// lib/crearcmd-arreglo.js
// Aplica una correccion (codigo ya generado por IA) sobre el archivo de un
// comando que YA existe: valida en un proceso aparte, hace respaldo, instala en
// caliente y, si algo sale mal, deja el original como estaba.
// (Antes vivia dentro de commands/owner/arreglarcmd.js; se movio aqui para que
// tambien lo use el flujo de "plan y confirmacion".)

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { guardarEstado } = require('./crearcmd-estado');

const RUTA_RUNNER = path.join(__dirname, 'addcmd-runner.js');
const RAIZ_BOT = path.join(__dirname, '..');

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

// Devuelve { ok: true, rutaRespaldo, comandosInstalados: [cmd...], archivo }
//       o { ok: false, error, revertido }
async function aplicarArreglo({ jid, comando, rutaOriginal, codigoNuevo, descripcionProblema, comandos }) {
  const guardarFallo = (error) => guardarEstado(jid, {
    estado: 'fallo',
    descripcionOriginal: `Reparacion de "${comando.name}": ${descripcionProblema}`,
    codigo: codigoNuevo,
    error,
    nombre: comando.name,
    categoria: comando.category || 'general',
    rutaArchivoFinal: rutaOriginal
  });

  // Se valida en la MISMA carpeta que el archivo original (no en _staging),
  // porque algunos comandos viven mas anidados que otros (ej. commands/download/dvyer/*.js
  // usa ../../../lib/... en vez de ../../lib/...). Si se valida en otra profundidad,
  // esos require() relativos calculan mal y truena aunque el codigo este bien.
  const rutaStaging = path.join(path.dirname(rutaOriginal), `.fix_${Date.now()}.js`);
  fs.writeFileSync(rutaStaging, codigoNuevo);

  const validacion = await validarEnProcesoAparte(rutaStaging);
  if (!validacion.ok) {
    try { fs.unlinkSync(rutaStaging); } catch (_) {}
    const error = validacion.error || 'Error desconocido validando la correccion.';
    guardarFallo(error);
    return { ok: false, error, revertido: false };
  }

  // Respaldo del archivo original antes de sobreescribir, por si hay que volver atras a mano.
  const rutaRespaldo = `${rutaOriginal}.bak-${Date.now()}`;
  fs.copyFileSync(rutaOriginal, rutaRespaldo);
  fs.copyFileSync(rutaStaging, rutaOriginal);
  fs.unlinkSync(rutaStaging);

  const revertir = () => {
    fs.copyFileSync(rutaRespaldo, rutaOriginal);
    try { delete require.cache[require.resolve(rutaOriginal)]; } catch (_) {}
  };

  let modulo;
  try {
    delete require.cache[require.resolve(rutaOriginal)];
    modulo = require(rutaOriginal);
  } catch (err) {
    revertir();
    const error = String(err.stack || err).slice(0, 3500);
    guardarFallo(error);
    return { ok: false, error, revertido: true };
  }

  const instalados = [];
  for (const cmd of (Array.isArray(modulo) ? modulo : [modulo])) {
    if (!cmd?.name || typeof cmd.execute !== 'function') continue;
    cmd._rutaArchivo = rutaOriginal;
    comandos.set(cmd.name, cmd);
    if (Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) comandos.set(alias, cmd);
    }
    instalados.push(cmd);
  }

  if (!instalados.length) {
    revertir();
    const error = 'La correccion se cargo pero no contenia ningun comando valido.';
    guardarFallo(error);
    return { ok: false, error, revertido: true };
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

  return {
    ok: true,
    rutaRespaldo,
    comandosInstalados: instalados,
    archivo: path.relative(RAIZ_BOT, rutaOriginal)
  };
}

module.exports = { aplicarArreglo };

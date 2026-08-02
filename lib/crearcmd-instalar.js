// lib/crearcmd-instalar.js
// Logica compartida para validar en un proceso aparte e instalar en caliente
// un comando generado por IA (ya sea creado desde cero con .crearcmd o
// adaptado desde un archivo .js subido con .adaptarcmd). Se saco de
// crearcmd.js para que ambos comandos usen el mismo motor sin duplicar
// esta parte delicada.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { guardarEstado } = require('./crearcmd-estado');

const CARPETA_COMANDOS = path.join(__dirname, '..', 'commands');
const CARPETA_STAGING = path.join(CARPETA_COMANDOS, '_staging');
const RUTA_RUNNER = path.join(__dirname, 'addcmd-runner.js');

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

// codigo: string con el .js final (ya limpio de fences de markdown, etc).
// jid: chat donde se guarda el estado de intento (para poder pedir arreglos despues).
// comandos: el Map en vivo de comandos del bot (se registra ahi mismo, sin reiniciar).
// descripcionOriginal: texto que se guarda en el estado, para poder re-explicar el contexto si hay que arreglarlo despues.
// categoriaForzada: si se da, SIEMPRE se usa esta categoria sin importar lo que diga el codigo generado.
// rutaDestinoForzada: si se da (arreglando un intento previo ya instalado), se sobreescribe ese mismo archivo en vez de crear uno nuevo.
async function procesarYInstalarCodigo({ codigo, jid, comandos, descripcionOriginal, categoriaForzada, rutaDestinoForzada }) {
  if (!fs.existsSync(CARPETA_STAGING)) fs.mkdirSync(CARPETA_STAGING, { recursive: true });
  const rutaStaging = path.join(CARPETA_STAGING, `ia_${Date.now()}.js`);
  fs.writeFileSync(rutaStaging, codigo);

  const resultado = await validarEnProcesoAparte(rutaStaging);

  if (!resultado.ok) {
    fs.unlinkSync(rutaStaging);
    guardarEstado(jid, {
      estado: 'fallo',
      descripcionOriginal,
      codigo,
      error: resultado.error,
      nombre: null,
      categoria: categoriaForzada || null,
      rutaArchivoFinal: rutaDestinoForzada || null
    });
    return { ok: false, mensajeError: resultado.error || 'Error desconocido validando el codigo generado.' };
  }

  const listaComandos = resultado.comandos;
  const categoria = sanitizar(categoriaForzada) || sanitizar(listaComandos[0].category) || 'general';
  const nombreBase = sanitizar(listaComandos[0].name) || `iacmd_${Date.now()}`;

  let rutaDestino;
  if (rutaDestinoForzada) {
    rutaDestino = rutaDestinoForzada;
  } else {
    const carpetaDestino = path.join(CARPETA_COMANDOS, categoria);
    if (!fs.existsSync(carpetaDestino)) fs.mkdirSync(carpetaDestino, { recursive: true });
    rutaDestino = path.join(carpetaDestino, `${nombreBase}.js`);

    if (fs.existsSync(rutaDestino) && !comandos.get(nombreBase)?._creadoPorIA) {
      fs.unlinkSync(rutaStaging);
      guardarEstado(jid, {
        estado: 'fallo',
        descripcionOriginal,
        codigo,
        error: `Ya existe un comando llamado "${nombreBase}" en la categoria "${categoria}" y no fue creado por IA, asi que no se sobreescribe solo.`,
        nombre: nombreBase,
        categoria
      });
      return { ok: false, mensajeError: `Ya existe un comando llamado "${nombreBase}" en la categoria "${categoria}". Dile que le cambie el nombre.` };
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
      descripcionOriginal,
      codigo,
      error: String(err.stack || err).slice(0, 3500),
      nombre: nombreBase,
      categoria,
      rutaArchivoFinal: rutaDestino
    });
    return { ok: false, mensajeError: String(err.stack || err).slice(0, 3500) };
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
    resumen.push(cmd);
  }

  if (!resumen.length) {
    return { ok: false, mensajeError: 'El codigo se cargo pero no contenia ningun comando valido (falta name o execute).' };
  }

  guardarEstado(jid, {
    estado: 'exito',
    descripcionOriginal,
    codigo,
    error: null,
    nombre: nombreBase,
    categoria,
    rutaArchivoFinal: rutaDestino
  });

  return { ok: true, categoria, rutaDestino, comandosInstalados: resumen };
}

module.exports = { procesarYInstalarCodigo, sanitizar };

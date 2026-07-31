// lib/addcmd-runner.js
// Script standalone (NO se importa desde index.js). Se ejecuta como un proceso
// de Node aparte: `node lib/addcmd-runner.js <ruta-al-archivo>`.
//
// Su unico trabajo es hacer `require()` del archivo candidato y reportar,
// en JSON por stdout, si cargo bien y que exporta. Al correr en un proceso
// separado, si el archivo tiene un error al cargarlo (o un bucle infinito
// en codigo de nivel superior), el que se cuelga o truena es este proceso
// hijo, no el bot principal.

const rutaArchivo = process.argv[2];

function analizarModulo(mod) {
  const lista = Array.isArray(mod) ? mod : [mod];
  return lista.map((c) => ({
    name: c && c.name ? String(c.name) : null,
    category: c && c.category ? String(c.category) : null,
    aliases: Array.isArray(c && c.aliases) ? c.aliases.map(String) : [],
    description: (c && c.description) ? String(c.description) : '',
    hasExecute: !!(c && typeof c.execute === 'function')
  }));
}

function salir(resultado) {
  process.stdout.write(JSON.stringify(resultado));
  process.exit(resultado.ok ? 0 : 1);
}

if (!rutaArchivo) {
  salir({ ok: false, error: 'No se recibio la ruta del archivo a validar.' });
} else {
  try {
    delete require.cache[require.resolve(rutaArchivo)];
    const mod = require(rutaArchivo);
    const info = analizarModulo(mod);

    if (!info.length) {
      salir({ ok: false, error: 'El archivo no exporta nada (module.exports esta vacio).' });
    } else {
      const invalido = info.find((c) => !c.name || !c.hasExecute);
      if (invalido) {
        salir({
          ok: false,
          error: 'El archivo debe exportar (o module.exports = [ {...} ]) un objeto con al menos "name" (texto) y "execute" (funcion). Revisa que no falte ninguno de los dos.'
        });
      } else {
        salir({ ok: true, comandos: info });
      }
    }
  } catch (err) {
    salir({ ok: false, error: String((err && err.stack) || err).slice(0, 3500) });
  }
}

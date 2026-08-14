// lib/memoria.js
// Monitor de memoria del bot. Cada minuto revisa cuanta RAM real esta usando
// el proceso (RSS = memoria fisica de verdad, no solo el heap de JS). Si se
// mantiene por encima de UMBRAL_LIMPIEZA_MB de forma sostenida por
// MINUTOS_SOSTENIDOS_PARA_LIMPIAR, hace una "limpieza suave": poda todos los
// caches conocidos del bot (historiales de IA, metadata de grupos, buffers
// de Simon, propuestas de matrimonio vencidas) y barre archivos temporales
// viejos. Si Node se inicio con --expose-gc, tambien fuerza una recoleccion
// de basura manual despues de podar.
//
// OJO: esto NO reinicia el bot. El reinicio duro a 1.5GB se deja en manos de
// PM2 (opcion max_memory_restart), que es mas confiable para eso porque
// vigila la memoria desde AFUERA del proceso -- si el proceso mismo esta tan
// saturado que ni puede correr su propio codigo de limpieza, PM2 igual lo
// detecta y reinicia. Ver instrucciones de instalacion para configurarlo.

const UMBRAL_LIMPIEZA_MB = 1024; // 1GB
const MINUTOS_SOSTENIDOS_PARA_LIMPIAR = 10;
const INTERVALO_REVISION_MS = 60 * 1000; // revisa cada 1 minuto
const INTERVALO_BARRIDO_TEMP_MS = 15 * 60 * 1000; // barre temporales cada 15 min, pase lo que pase con la RAM

let intervaloRevision = null;
let intervaloBarridoTemp = null;
let momentoDesdeQueSuperoElUmbral = null;

function mbActuales() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function limpiezaSuave() {
  const resultados = [];

  try {
    const { podarTodosLosHistoriales } = require('./iaAmigos');
    resultados.push(`historiales IA: ${podarTodosLosHistoriales()} podados`);
  } catch (e) {
    resultados.push(`historiales IA: error (${e.message})`);
  }

  try {
    const { podarBuffersInactivos } = require('./simonWatcher');
    resultados.push(`buffers Simon: ${podarBuffersInactivos()} podados`);
  } catch (e) {
    resultados.push(`buffers Simon: error (${e.message})`);
  }

  try {
    const { limpiarExpiradas, propuestasPorMensaje } = require('./matrimonio');
    const antes = propuestasPorMensaje.size;
    limpiarExpiradas();
    resultados.push(`propuestas matrimonio: ${antes - propuestasPorMensaje.size} podadas`);
  } catch (e) {
    resultados.push(`propuestas matrimonio: error (${e.message})`);
  }

  try {
    const { limpiarTemporales } = require('./limpiezaTemp');
    const { borrados, liberadoBytes } = limpiarTemporales();
    resultados.push(`temporales: ${borrados} borrados (${(liberadoBytes / 1024 / 1024).toFixed(1)}MB)`);
  } catch (e) {
    resultados.push(`temporales: error (${e.message})`);
  }

  return resultados;
}

// Recibe funciones de poda extra especificas de index.js (como la cache de
// metadata de grupos, que vive ahi y no en un lib/ separado).
function iniciarMonitorMemoria(podasExtra = []) {
  if (intervaloRevision) clearInterval(intervaloRevision);
  if (intervaloBarridoTemp) clearInterval(intervaloBarridoTemp);
  momentoDesdeQueSuperoElUmbral = null;

  intervaloRevision = setInterval(() => {
    const mb = mbActuales();

    if (mb >= UMBRAL_LIMPIEZA_MB) {
      if (!momentoDesdeQueSuperoElUmbral) momentoDesdeQueSuperoElUmbral = Date.now();

      const minutosSostenido = (Date.now() - momentoDesdeQueSuperoElUmbral) / 60000;
      if (minutosSostenido >= MINUTOS_SOSTENIDOS_PARA_LIMPIAR) {
        console.log(`🧹 [memoria] RAM en ${mb}MB por mas de ${MINUTOS_SOSTENIDOS_PARA_LIMPIAR} min seguidos. Limpiando caches...`);

        const resultados = limpiezaSuave();
        for (const extra of podasExtra) {
          try {
            const n = extra();
            resultados.push(`extra: ${n} podados`);
          } catch (e) {
            resultados.push(`extra: error (${e.message})`);
          }
        }

        if (typeof global.gc === 'function') {
          global.gc();
          resultados.push('recoleccion de basura forzada (--expose-gc)');
        } else {
          resultados.push('(tip: inicia con --expose-gc para poder forzar recoleccion de basura tambien)');
        }

        console.log('🧹 [memoria] Resultado de la limpieza:\n  - ' + resultados.join('\n  - '));
        console.log(`🧹 [memoria] RAM despues de limpiar: ${mbActuales()}MB (antes: ${mb}MB)`);

        momentoDesdeQueSuperoElUmbral = null; // vuelve a contar desde cero
      }
    } else {
      momentoDesdeQueSuperoElUmbral = null; // bajo del umbral, se reinicia el conteo
    }
  }, INTERVALO_REVISION_MS);

  // Barrido de temporales independiente del uso de RAM, para no dejar
  // archivos huerfanos acumulandose en disco aunque la RAM nunca llegue al umbral.
  intervaloBarridoTemp = setInterval(() => {
    try {
      const { limpiarTemporales } = require('./limpiezaTemp');
      const { borrados, liberadoBytes } = limpiarTemporales();
      if (borrados > 0) {
        console.log(`🧹 [memoria] Barrido periodico de temporales: ${borrados} archivos borrados (${(liberadoBytes / 1024 / 1024).toFixed(1)}MB liberados).`);
      }
    } catch (e) {
      console.error('[memoria] Error en barrido periodico de temporales:', e.message);
    }
  }, INTERVALO_BARRIDO_TEMP_MS);

  console.log(`🧹 [memoria] Monitor de memoria activo (umbral: ${UMBRAL_LIMPIEZA_MB}MB sostenido ${MINUTOS_SOSTENIDOS_PARA_LIMPIAR} min, revision cada ${INTERVALO_REVISION_MS / 1000}s).`);
}

module.exports = { iniciarMonitorMemoria, limpiezaSuave, mbActuales };

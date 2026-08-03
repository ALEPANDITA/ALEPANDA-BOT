const fs = require('fs');
const path = require('path');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');
const { generarTexto } = require('../../lib/gemini');
const { construirPromptArreglo, limpiarCodigo } = require('../../lib/crearcmd-ia');
const { procesarYInstalarCodigo } = require('../../lib/crearcmd-instalar');

const CARPETA_COMANDOS = path.join(__dirname, '..', '..', 'commands');
const TIMEOUT_PRUEBA_MS = 20000;
const INTENTOS_REPARACION = 2;

function conTimeout(promesa, ms, mensaje) {
  return Promise.race([
    promesa,
    new Promise((_, reject) => setTimeout(() => reject(new Error(mensaje || `Timeout de ${ms / 1000}s`)), ms))
  ]);
}

// Corre un comando en un chat/socket FALSOS (no manda nada real todavia) para
// ver si de verdad funciona. Exito = no truena Y termina mandando un archivo
// de media (video/imagen/audio/sticker/documento) -- si solo mando texto es
// casi siempre el propio comando reportando su error interno.
async function probarComando(cmd, sockReal, jid, remitente, comandos, prefix) {
  const llamadas = [];
  const consoleCapturado = [];
  const sockFalso = {
    sendMessage: async (destJid, contenido) => {
      llamadas.push(contenido);
      return { key: { id: `FAKE_${Date.now()}`, remoteJid: destJid } };
    },
    user: sockReal.user
  };
  const msgFalso = {
    key: { remoteJid: jid, participant: remitente, fromMe: false, id: `TEST_${Date.now()}` },
    message: { extendedTextMessage: { contextInfo: {} } }
  };

  const originalError = console.error;
  console.error = (...args) => {
    consoleCapturado.push(args.map((a) => a?.stack || a?.message || String(a)).join(' '));
  };

  let excepcion = null;
  try {
    await conTimeout(
      cmd.execute(sockFalso, jid, msgFalso, { texto: `${prefix}${cmd.name}`, prefix, comandos }),
      TIMEOUT_PRUEBA_MS,
      `El comando tardo mas de ${TIMEOUT_PRUEBA_MS / 1000}s en responder (posible API caida sin timeout propio)`
    );
  } catch (err) {
    excepcion = err.message || String(err);
  } finally {
    console.error = originalError;
  }

  const tieneMedia = llamadas.some((c) => c && (c.video || c.image || c.audio || c.sticker || c.document));
  const textoEnviado = llamadas.find((c) => c?.text)?.text;

  return { ok: !excepcion && tieneMedia, excepcion, consoleCapturado, textoEnviado };
}

module.exports = {
  name: 'repararcmd',
  aliases: ['revisarcmd'],
  category: 'owner',
  description: 'Solo owner: prueba, repara con IA y demuestra en vivo todos los comandos de una categoria. Uso: .repararcmd <categoria>',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const categoria = texto.trim().split(/\s+/)[1];
    if (!categoria) {
      return sock.sendMessage(jid, {
        text: caja([`Uso: ${prefix}repararcmd <categoria>`, `Ejemplo: ${prefix}repararcmd anime`], { titulo: 'REPARARCMD', estilo: 'neon' })
      });
    }

    const carpetaCategoria = path.join(CARPETA_COMANDOS, categoria);
    if (!fs.existsSync(carpetaCategoria)) {
      return sock.sendMessage(jid, { text: cajaError(`No existe la categoria "${categoria}".`) });
    }

    const archivos = fs.readdirSync(carpetaCategoria).filter((f) => f.endsWith('.js'));
    if (!archivos.length) {
      return sock.sendMessage(jid, { text: advertencia(`La categoria "${categoria}" no tiene archivos .js.`) });
    }

    const remitente = msg.key.participant || msg.key.remoteJid;

    // --- Deteccion de nombres duplicados entre archivos (esto la IA no lo puede arreglar archivo por archivo) ---
    const nombrePorArchivo = {};
    for (const archivo of archivos) {
      try {
        delete require.cache[require.resolve(path.join(carpetaCategoria, archivo))];
        const mod = require(path.join(carpetaCategoria, archivo));
        const lista = Array.isArray(mod) ? mod : [mod];
        for (const c of lista) {
          if (!c?.name) continue;
          if (!nombrePorArchivo[c.name]) nombrePorArchivo[c.name] = [];
          nombrePorArchivo[c.name].push(archivo);
        }
      } catch (e) { /* si ni siquiera carga, ya se va a reportar en el loop principal */ }
    }
    const duplicados = Object.entries(nombrePorArchivo).filter(([, lista]) => lista.length > 1);
    if (duplicados.length) {
      const lineas = duplicados.map(([nombre, lista]) => `.${nombre} esta repetido en: ${lista.join(', ')}`);
      await sock.sendMessage(jid, {
        text: caja(
          [...lineas, '', 'Estos NO los puedo arreglar solo reescribiendo cada archivo (el problema es que se pisan entre si). Te aviso pero sigo revisando el resto.'],
          { titulo: '⚠️ NOMBRES DUPLICADOS', estilo: 'neon' }
        )
      });
    }

    await sock.sendMessage(jid, {
      text: caja([`${archivos.length} archivos en "${categoria}". Los voy a probar uno por uno...`], { titulo: '🔍 REPARARCMD INICIADO', estilo: 'neon' })
    }, { quoted: msg });

    const resumenOk = [];
    const resumenArreglados = [];
    const resumenFallidos = [];

    for (const archivo of archivos) {
      const rutaArchivo = path.join(carpetaCategoria, archivo);
      let codigoActual = fs.readFileSync(rutaArchivo, 'utf-8');
      let modulo;
      try {
        delete require.cache[require.resolve(rutaArchivo)];
        modulo = require(rutaArchivo);
      } catch (err) {
        resumenFallidos.push(`${archivo}: no cargo (${err.message})`);
        await sock.sendMessage(jid, { text: cajaError(`${archivo}: el archivo ni siquiera carga (${err.message}). Saltando a intentar repararlo...`) });
        modulo = null;
      }

      let comandosDelArchivo = modulo ? (Array.isArray(modulo) ? modulo : [modulo]) : [];
      let fallas = [];

      if (modulo) {
        for (const cmd of comandosDelArchivo) {
          if (!cmd?.name || typeof cmd.execute !== 'function') {
            fallas.push({ nombre: cmd?.name || '(sin nombre)', motivo: 'No exporta name/execute validos.' });
            continue;
          }
          const resultado = await probarComando(cmd, sock, jid, remitente, comandos, prefix);
          if (!resultado.ok) {
            fallas.push({
              nombre: cmd.name,
              motivo: resultado.excepcion || `Solo mando texto (posible fallo silencioso): "${(resultado.textoEnviado || '').slice(0, 200)}"`,
              consola: resultado.consoleCapturado.join('\n').slice(0, 1500)
            });
          }
        }
      } else {
        fallas.push({ nombre: archivo, motivo: 'El archivo no compila/carga.' });
      }

      if (!fallas.length) {
        resumenOk.push(`${archivo} (${comandosDelArchivo.map((c) => '.' + c.name).join(', ')})`);
        await sock.sendMessage(jid, { text: `✅ ${archivo} — funciona bien, no toco nada.` });
        continue;
      }

      // --- Hay fallas: pedirle a la IA que repare el archivo completo ---
      let arreglado = false;
      for (let intento = 1; intento <= INTENTOS_REPARACION && !arreglado; intento++) {
        await sock.sendMessage(jid, {
          text: `🛠️ ${archivo} — fallo en: ${fallas.map((f) => '.' + f.nombre).join(', ')}. Reparando con IA (intento ${intento}/${INTENTOS_REPARACION})...`
        });

        const errorTexto = fallas.map((f) =>
          `- .${f.nombre}: ${f.motivo}${f.consola ? `\n  console.error capturado: ${f.consola}` : ''}`
        ).join('\n');

        const prompt = construirPromptArreglo({
          descripcionOriginal: `Comando(s) de reaccion/anime en el archivo "${archivo}" de la categoria "${categoria}". Debe(n) mandar un video/gif/imagen de reaccion (con o sin mencionar a alguien).`,
          codigoAnterior: codigoActual,
          errorAnterior: `Esto se detecto probando el comando en produccion de verdad (no es un error de sintaxis, el archivo carga pero falla al ejecutarse):\n${errorTexto}`,
          aclaracionUsuario: 'Si la API que usa esta caida, no existe, o el dominio no responde, cambiala por una alternativa real y funcional para gifs/imagenes de reacciones de anime (ej: nekos.best, waifu.pics), o agrega un respaldo. Mantén los mismos nombres de comando.'
        });

        let respuestaIA;
        try {
          respuestaIA = await generarTexto(prompt);
        } catch (err) {
          resumenFallidos.push(`${archivo}: no se pudo generar reparacion (${err.message})`);
          await sock.sendMessage(jid, { text: cajaError(`${archivo}: no se pudo generar la reparacion (${err.message}).`) });
          break;
        }

        const codigoNuevo = limpiarCodigo(respuestaIA);
        if (!codigoNuevo) {
          continue;
        }

        const resultadoInstalacion = await procesarYInstalarCodigo({
          codigo: codigoNuevo,
          jid,
          comandos,
          descripcionOriginal: `Reparacion automatica de ${archivo} (categoria ${categoria})`,
          categoriaForzada: categoria,
          rutaDestinoForzada: rutaArchivo
        });

        if (!resultadoInstalacion.ok) {
          codigoActual = codigoNuevo; // para que el siguiente intento parta de esta version, no de la rota original
          continue;
        }

        // Reinstalado -- volver a probar cada comando para confirmar de verdad.
        delete require.cache[require.resolve(rutaArchivo)];
        const moduloNuevo = require(rutaArchivo);
        const comandosNuevos = Array.isArray(moduloNuevo) ? moduloNuevo : [moduloNuevo];

        let todosPasaron = true;
        for (const cmd of comandosNuevos) {
          const r = await probarComando(cmd, sock, jid, remitente, comandos, prefix);
          if (!r.ok) todosPasaron = false;
        }

        if (todosPasaron) {
          arreglado = true;
          resumenArreglados.push(`${archivo} (${comandosNuevos.map((c) => '.' + c.name).join(', ')})`);

          await sock.sendMessage(jid, { text: `✅ ${archivo} reparado. Mandando resultado real para que lo veas:` });

          // Demo en vivo: ahora si, con el sock real, en este chat.
          for (const cmd of comandosNuevos) {
            try {
              await cmd.execute(sock, jid, msg, { texto: `${prefix}${cmd.name}`, prefix, comandos });
            } catch (err) {
              await sock.sendMessage(jid, { text: cajaError(`.${cmd.name} volvio a fallar al mandarlo de verdad: ${err.message}`) });
            }
          }
        } else {
          codigoActual = codigoNuevo;
        }
      }

      if (!arreglado) {
        resumenFallidos.push(`${archivo}: sigue fallando despues de ${INTENTOS_REPARACION} intentos.`);
        await sock.sendMessage(jid, {
          text: cajaError(`${archivo}: no se pudo reparar automaticamente despues de ${INTENTOS_REPARACION} intentos. Puede que necesite revision manual.`)
        });
      }
    }

    const lineasFinal = [
      `✅ Ya funcionaban: ${resumenOk.length}`,
      `🛠️ Reparados: ${resumenArreglados.length}`,
      `❌ Sin reparar: ${resumenFallidos.length}`
    ];
    if (resumenFallidos.length) {
      lineasFinal.push('', ...resumenFallidos.map((f) => `- ${f}`));
    }
    if (duplicados.length) {
      lineasFinal.push('', `⚠️ Ademas quedaron ${duplicados.length} nombre(s) duplicados entre archivos (ver arriba), esos hay que resolverlos a mano.`);
    }

    await sock.sendMessage(jid, {
      text: caja(lineasFinal, { titulo: `🏁 REPARARCMD TERMINADO (${categoria})`, estilo: 'neon' })
    });
  }
};

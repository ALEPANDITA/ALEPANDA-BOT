const path = require('path');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');
const { generarTexto } = require('../../lib/gemini');
const { construirPromptNuevo, construirPromptArreglo, limpiarCodigo } = require('../../lib/crearcmd-ia');
const { obtenerEstado, guardarEstado, borrarEstado } = require('../../lib/crearcmd-estado');
const { procesarYInstalarCodigo } = require('../../lib/crearcmd-instalar');

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

    const resultado = await procesarYInstalarCodigo({
      codigo,
      jid,
      comandos,
      descripcionOriginal: esArreglo ? estadoParaUsar.descripcionOriginal : descripcionUsuario,
      rutaDestinoForzada: esArreglo ? estadoParaUsar.rutaArchivoFinal : null
    });

    if (!resultado.ok) {
      return sock.sendMessage(jid, {
        text: caja(
          [resultado.mensajeError, '', `Dime exactamente que pasa (o que deberia pasar) con ${prefix}crearcmd <lo que esta mal> y lo corrijo.`],
          { titulo: 'NO FUNCIONO, REVISANDO', estilo: 'neon' }
        )
      });
    }

    const resumen = resultado.comandosInstalados.map((cmd) => {
      const aliasTxt = cmd.aliases?.length ? ` _(${cmd.aliases.map((a) => prefix + a).join(', ')})_` : '';
      return `${prefix}${cmd.name}${aliasTxt} — ${cmd.description || 'sin descripcion'}`;
    });

    await sock.sendMessage(jid, {
      text: exito(
        `Instalado y activo YA, sin reiniciar el bot.\n\n` +
        `Categoria: *${resultado.categoria}*\n` +
        `Archivo: commands/${resultado.categoria}/${path.basename(resultado.rutaDestino)}\n\n` +
        `${resumen.join('\n')}\n\n` +
        `Si algo no funciona bien, dime exactamente que pasa con ${prefix}crearcmd <lo que esta mal> y lo corrijo sin que tengas que repetir toda la descripcion.`,
        { titulo: 'CREARCMD', estilo: 'neon' }
      )
    });
  }
};

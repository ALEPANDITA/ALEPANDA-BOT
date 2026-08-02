const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { advertencia, exito, error: cajaError, caja } = require('../../lib/estilo');
const { generarTexto } = require('../../lib/gemini');
const { construirPromptAdaptar, limpiarCodigo } = require('../../lib/crearcmd-ia');
const { procesarYInstalarCodigo } = require('../../lib/crearcmd-instalar');

const TAMANO_MAXIMO = 150 * 1024; // 150 KB, de sobra para un solo comando

// Detecta un documentMessage, ya sea adjunto directo (con caption
// ".adaptarcmd ...") o citando/respondiendo un archivo ya mandado antes.
function encontrarDocumento(msg) {
  const citado = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
  if (citado?.documentMessage) return { message: citado };
  if (msg.message.documentMessage) return msg;
  return null;
}

module.exports = {
  name: 'adaptarcmd',
  aliases: ['jscmd', 'importarcmd'],
  category: 'owner',
  description: 'Sube o responde un archivo .js con este comando: la IA lo adapta a la estructura del bot y lo instala. Uso: .adaptarcmd <categoria> [instrucciones]',
  execute: async (sock, jid, msg, { prefix, texto, comandos }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' }) });
    }

    const mensajeConDoc = encontrarDocumento(msg);
    const docInfo = mensajeConDoc?.message?.documentMessage;

    if (!mensajeConDoc || !docInfo) {
      return sock.sendMessage(jid, {
        text: caja(
          [
            `Manda un archivo .js con el caption "${prefix}adaptarcmd <categoria> [instrucciones]", o responde a un .js ya mandado con ese mismo texto.`,
            `Ejemplo: ${prefix}adaptarcmd fun adaptalo para que responda con stickers`
          ],
          { titulo: 'ADAPTARCMD', estilo: 'neon' }
        )
      });
    }

    const nombreArchivo = docInfo.fileName || '';
    const esJs = nombreArchivo.toLowerCase().endsWith('.js') || (docInfo.mimetype || '').includes('javascript');
    if (!esJs) {
      return sock.sendMessage(jid, { text: advertencia(`Ese archivo no parece ser un .js (recibi "${nombreArchivo}"). Sube uno con extension .js.`) });
    }

    const tamano = Number(docInfo.fileLength) || 0;
    if (tamano > TAMANO_MAXIMO) {
      return sock.sendMessage(jid, { text: advertencia(`El archivo pesa demasiado (${Math.round(tamano / 1024)} KB). Un solo comando no deberia pesar mas de ${Math.round(TAMANO_MAXIMO / 1024)} KB.`) });
    }

    const argumentos = texto.trim().split(/\s+/).slice(1);
    const categoriaForzada = argumentos[0] || null;
    const instruccionUsuario = argumentos.slice(1).join(' ').trim();

    await sock.sendMessage(jid, { text: '📥 Descargando y leyendo el archivo...' }, { quoted: msg });

    let codigoOriginal;
    try {
      const buffer = await downloadMediaMessage(mensajeConDoc, 'buffer', {});
      codigoOriginal = buffer.toString('utf-8');
    } catch (err) {
      return sock.sendMessage(jid, { text: cajaError(`No se pudo descargar el archivo: ${err.message}`) });
    }

    if (!codigoOriginal.trim()) {
      return sock.sendMessage(jid, { text: cajaError('El archivo llego vacio.') });
    }

    await sock.sendMessage(jid, {
      text: `🧠 Adaptando el codigo con IA${categoriaForzada ? ` para la categoria *${categoriaForzada}*` : ''}...`
    });

    const prompt = construirPromptAdaptar(codigoOriginal, instruccionUsuario, categoriaForzada);

    let respuestaIA;
    try {
      respuestaIA = await generarTexto(prompt);
    } catch (err) {
      const msgErr = err.code === 'NO_API_KEY'
        ? 'No hay ninguna API key de IA configurada (Gemini/Groq/OpenRouter). Configura una con .setapikey para poder usar este comando.'
        : `No se pudo adaptar el codigo: ${err.message}`;
      return sock.sendMessage(jid, { text: cajaError(msgErr) });
    }

    const codigo = limpiarCodigo(respuestaIA);
    if (!codigo) {
      return sock.sendMessage(jid, { text: cajaError('La IA no devolvio ningun codigo utilizable.') });
    }

    const resultado = await procesarYInstalarCodigo({
      codigo,
      jid,
      comandos,
      descripcionOriginal: `(adaptado desde el archivo subido "${nombreArchivo}"${instruccionUsuario ? ', instrucciones: ' + instruccionUsuario : ''})`,
      categoriaForzada
    });

    if (!resultado.ok) {
      return sock.sendMessage(jid, {
        text: caja(
          [resultado.mensajeError, '', `Dime que esta mal con ${prefix}crearcmd <lo que esta mal> y lo corrijo (usa el mismo sistema de arreglo que .crearcmd).`],
          { titulo: 'NO SE PUDO ADAPTAR', estilo: 'neon' }
        )
      });
    }

    const resumen = resultado.comandosInstalados.map((cmd) => {
      const aliasTxt = cmd.aliases?.length ? ` _(${cmd.aliases.map((a) => prefix + a).join(', ')})_` : '';
      return `${prefix}${cmd.name}${aliasTxt} — ${cmd.description || 'sin descripcion'}`;
    });

    await sock.sendMessage(jid, {
      text: exito(
        `Adaptado e instalado YA, sin reiniciar el bot.\n\n` +
        `Archivo original: ${nombreArchivo}\n` +
        `Categoria: *${resultado.categoria}*\n\n` +
        `${resumen.join('\n')}\n\n` +
        `Si algo no quedo bien, dime que esta mal con ${prefix}crearcmd <lo que esta mal> y lo corrijo.`,
        { titulo: 'ADAPTARCMD', estilo: 'neon' }
      )
    });
  }
};

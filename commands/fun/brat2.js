const { advertencia, error: cajaError } = require('../../lib/estilo');

// .brat2 <texto> -> sticker brat animado (hoja blanca, las palabras aparecen al ritmo de la voz) CON SONIDO.
// Se manda igual que .sa (lib/stickersonido.js). Necesita espeak-ng en el servidor: apt install -y espeak-ng
module.exports = {
  name: 'brat2',
  category: 'fun',
  description: 'Sticker brat animado con voz y sonido (hoja blanca, las palabras aparecen al hablar). Escribe un texto o responde a un mensaje',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const escrito = String(texto || '').trim().split(/\s+/).slice(1).join(' ').trim();
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;
    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}brat2 Hola mundo`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      }, { quoted: msg });
    }

    const { crearBratConVoz, MAX_CARACTERES, SEGUNDOS_MAX } = require('../../lib/bratvoz');
    const { enviarSonoro, parcheActivo } = require('../../lib/stickersonido');
    const { AUTOR_POR_DEFECTO } = require('../../lib/stickerlib');
    if (!parcheActivo()) {
      return sock.sendMessage(jid, { text: cajaError('Falta activar el parche de la libreria para stickers con sonido (scripts/parche-sticker-sonido.js) y reiniciar el bot.') }, { quoted: msg });
    }
    try {
      await sock.sendMessage(jid, { text: '🔊 Preparando tu brat con voz...' }, { quoted: msg });
      const brat = await crearBratConVoz(textoFinal, { author: `${AUTOR_POR_DEFECTO} ${msg.pushName || 'Usuario'}` });
      await enviarSonoro(sock, jid, brat);
    } catch (err) {
      console.error('[brat2]', err);
      let motivo;
      if (err.message === 'SIN_PARCHE') motivo = 'Falta activar el parche de la libreria para stickers con sonido.';
      else if (err.message === 'SIN_VOZ') motivo = 'Falta instalar la voz del bot en el servidor (espeak-ng).';
      else if (err.message === 'TEXTO_LARGO') motivo = `Ese texto es muy largo. Usa maximo ${MAX_CARACTERES} caracteres.`;
      else if (err.message === 'MUY_LARGO') motivo = `Ese texto dura mas de ${SEGUNDOS_MAX} segundos hablado. Acortalo un poco.`;
      else if (err.code === 'ENOENT') motivo = 'No encontre ffmpeg en el servidor.';
      else if (/muy pesado/.test(err.message)) motivo = err.message;
      else motivo = 'No se pudo crear el brat con voz.';
      await sock.sendMessage(jid, { text: cajaError(motivo) }, { quoted: msg });
    }
  }
};

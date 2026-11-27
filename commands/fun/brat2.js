const { advertencia, error: cajaError, caja, porCategoria } = require('../../lib/estilo');

// .brat2 <texto> -> sticker brat animado (hoja blanca, las palabras aparecen al ritmo de la voz) CON SONIDO.
// Se manda igual que .sa (lib/stickersonido.js). Necesita espeak-ng en el servidor: apt install -y espeak-ng
// Voz: .brat2 -grave Hola  (la lista: .brat2 voces). Sin voz usa la de siempre (jorge).
module.exports = {
  name: 'brat2',
  category: 'fun',
  description: 'Sticker brat animado con voz y sonido (hoja blanca, las palabras aparecen al hablar). Elige la voz con .brat2 -grave texto; lista: .brat2 voces',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const { resolverVoz, VOCES, VOZ_POR_DEFECTO } = require('../../lib/bratvoz');
    let palabras = String(texto || '').trim().split(/\s+/).slice(1);

    // .brat2 voces -> lista de voces
    if (palabras.length === 1 && /^voces?$/i.test(palabras[0])) {
      const lineas = Object.entries(VOCES).map(([k, v]) => `🎙️ *${prefix}brat2 -${k}* — ${v.nombre}`);
      lineas.push('', `Ejemplo: *${prefix}brat2 -grave Hola mundo*`, `Sin voz usa *${VOZ_POR_DEFECTO}*.`);
      return sock.sendMessage(jid, { text: caja(lineas, { titulo: 'VOCES DE BRAT2', estilo: porCategoria('fun') }) }, { quoted: msg });
    }

    // .brat2 -grave Hola -> la voz va primero, con guion
    let voz = VOZ_POR_DEFECTO;
    if (/^-[\p{L}]+$/u.test(palabras[0] || '')) {
      const elegida = resolverVoz(palabras[0].slice(1));
      if (!elegida) {
        return sock.sendMessage(jid, { text: advertencia(`No tengo la voz *${palabras[0]}*. Mira la lista con *${prefix}brat2 voces*`, { titulo: 'VOZ NO ENCONTRADA', estilo: 'kawaii' }) }, { quoted: msg });
      }
      voz = elegida; palabras = palabras.slice(1);
    }
    const escrito = palabras.join(' ').trim();
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;
    const textoFinal = escrito || textoCitado;

    if (!textoFinal) {
      return sock.sendMessage(jid, {
        text: advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}brat2 Hola mundo\nOtra voz: ${prefix}brat2 -grave Hola mundo  (lista: ${prefix}brat2 voces)`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' })
      }, { quoted: msg });
    }

    const { crearBratConVoz, MAX_CARACTERES, SEGUNDOS_MAX } = require('../../lib/bratvoz');
    const { enviarSonoro, parcheActivo } = require('../../lib/stickersonido');
    const { AUTOR_POR_DEFECTO } = require('../../lib/stickerlib');
    if (!parcheActivo()) {
      return sock.sendMessage(jid, { text: cajaError('Falta activar el parche de la libreria para stickers con sonido (scripts/parche-sticker-sonido.js) y reiniciar el bot.') }, { quoted: msg });
    }
    try {
      await sock.sendMessage(jid, { text: `🔊 Preparando tu brat con voz (${voz})...` }, { quoted: msg });
      const brat = await crearBratConVoz(textoFinal, { author: `${AUTOR_POR_DEFECTO} ${msg.pushName || 'Usuario'}`, voz });
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

const { advertencia, error: cajaError, caja, porCategoria } = require('../../lib/estilo');
const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

// .brat2 <texto> -> sticker brat animado (hoja blanca, las palabras aparecen al ritmo de la voz) CON SONIDO.
// Se manda igual que .sa (lib/stickersonido.js). Necesita espeak-ng en el servidor: apt install -y espeak-ng
// Voz (cada quien guarda la suya, sin voz usa la de siempre):
//   .brat2 grave            -> cambia TU voz y se queda guardada
//   .brat2 grave Hola       -> usa esa voz solo esta vez
//   .brat2 voces            -> lista de voces
module.exports = {
  name: 'brat2',
  category: 'fun',
  description: 'Sticker brat animado con voz y sonido. Cambia tu voz con .brat2 grave (lista: .brat2 voces)',
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const { crearBratConVoz, resolverVoz, VOCES, VOZ_POR_DEFECTO, MAX_CARACTERES, SEGUNDOS_MAX } = require('../../lib/bratvoz');
    const remitente = msg.key.participant || msg.key.remoteJid;
    let palabras = String(texto || '').trim().split(/\s+/).slice(1);
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const textoCitado = contextInfo?.quotedMessage?.conversation
      || contextInfo?.quotedMessage?.extendedTextMessage?.text;

    const db = leerDB();
    const perfil = getUsuario(db, remitente);
    const suVoz = VOCES[perfil.bratVoz] ? perfil.bratVoz : VOZ_POR_DEFECTO;
    const responder = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg });
    const guardarVoz = (clave) => {
      perfil.bratVoz = clave; guardarDB(db);
      return responder(`✅ Tu voz de brat2 ahora es *${clave}*.\nPruébala: *${prefix}brat2 Hola mundo*`);
    };
    const lista = () => {
      const lineas = Object.entries(VOCES).map(([k, v]) => `${k === suVoz ? '✅' : '🎙️'} *${k}* — ${v.nombre}`);
      lineas.push('', `Tu voz ahora: *${suVoz}*`, `Cambiarla: *${prefix}brat2 grave*`, `Solo esta vez: *${prefix}brat2 grave Hola mundo*`);
      return responder(caja(lineas, { titulo: 'VOCES DE BRAT2', estilo: porCategoria('fun') }));
    };

    // .brat2 voces
    if (palabras.length === 1 && /^voces?$/i.test(palabras[0])) return lista();
    // .brat2 voz  /  .brat2 voz grave
    if (/^voz$/i.test(palabras[0] || '') && (palabras.length === 1 || (palabras.length === 2 && resolverVoz(palabras[1])))) {
      return palabras.length === 1 ? lista() : guardarVoz(resolverVoz(palabras[1]));
    }

    // voz al principio (con o sin guion): .brat2 grave ...  /  .brat2 -grave ...
    let voz = suVoz;
    const primera = palabras[0] || '';
    const elegida = resolverVoz(primera.replace(/^-+/, ''));
    if (elegida) {
      if (palabras.length === 1 && !textoCitado) return guardarVoz(elegida); // solo el nombre: queda como tu voz
      voz = elegida; palabras = palabras.slice(1);
    } else if (/^-[\p{L}\p{N}]+$/u.test(primera)) {
      return responder(advertencia(`No tengo la voz *${primera}*. Mira la lista con *${prefix}brat2 voces*`, { titulo: 'VOZ NO ENCONTRADA', estilo: 'kawaii' }));
    }

    const textoFinal = palabras.join(' ').trim() || textoCitado;
    if (!textoFinal) {
      return responder(advertencia(`Escribe un texto o responde a un mensaje.\nEjemplo: ${prefix}brat2 Hola mundo\nCambiar la voz: ${prefix}brat2 grave  (lista: ${prefix}brat2 voces)`, { titulo: 'FALTA EL TEXTO', estilo: 'kawaii' }));
    }

    const { enviarSonoro, parcheActivo } = require('../../lib/stickersonido');
    const { AUTOR_POR_DEFECTO } = require('../../lib/stickerlib');
    if (!parcheActivo()) {
      return responder(cajaError('Falta activar el parche de la libreria para stickers con sonido (scripts/parche-sticker-sonido.js) y reiniciar el bot.'));
    }
    try {
      await responder(`🔊 Preparando tu brat con voz (${voz})...`);
      const brat = await crearBratConVoz(textoFinal, { author: `${AUTOR_POR_DEFECTO} ${msg.pushName || 'Usuario'}`, voz });
      await enviarSonoro(sock, jid, brat);
      if (brat.vozUsada && brat.vozUsada !== brat.vozPedida) {
        console.warn(`[brat2] la voz "${voz}" (${brat.vozPedida}) no esta disponible en el servidor; se uso ${brat.vozUsada}`);
        await responder(`⚠️ La voz *${voz}* no está lista en el servidor (falta instalarle algo) y usé una parecida.`);
      }
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
      await responder(cajaError(motivo));
    }
  }
};

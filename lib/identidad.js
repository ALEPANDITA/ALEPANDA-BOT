// lib/identidad.js
//
// WhatsApp puede reportar al mismo usuario con distinto JID segun el
// momento: a veces su numero real ("xxxxx@s.whatsapp.net") y a veces un
// identificador de privacidad ("xxxxx@lid"). Si distintas partes del bot
// usan JIDs de distinto formato como llave para la misma persona en la
// base de datos (ej: mute.js guarda con un formato, y el handler de
// mensajes busca con otro), las funciones que dependen de eso (mute,
// warns, economia, etc.) fallan en silencio porque buscan en la llave
// equivocada.
//
// Esta funcion siempre devuelve el MISMO identificador para la misma
// persona sin importar como llego el mensaje: el numero real si se puede
// resolver, o el JID tal cual (siendo @lid) como respaldo -- lo importante
// es que sea consistente entre llamadas.

function conTimeout(promesa, ms, valorTimeout) {
  return new Promise((resolve) => {
    const temporizador = setTimeout(() => resolve(valorTimeout), ms);
    Promise.resolve(promesa).then(
      (valor) => { clearTimeout(temporizador); resolve(valor); },
      () => { clearTimeout(temporizador); resolve(valorTimeout); }
    );
  });
}

async function resolverJidReal(sock, participanteId, metadata) {
  if (!participanteId) return participanteId;

  if (participanteId.endsWith('@s.whatsapp.net')) {
    return participanteId;
  }

  try {
    const pn = await conTimeout(
      sock.signalRepository?.lidMapping?.getPNForLID?.(participanteId),
      2000,
      null
    );
    if (pn) {
      const numeroReal = pn.split('@')[0].split(':')[0];
      return `${numeroReal}@s.whatsapp.net`;
    }
  } catch (err) { /* este fork no soporta el mapeo, seguimos con el respaldo */ }

  const info = metadata?.participants?.find(p => p.id === participanteId || p.lid === participanteId);
  if (info?.phoneNumber) {
    return info.phoneNumber.includes('@') ? info.phoneNumber : `${info.phoneNumber}@s.whatsapp.net`;
  }

  // No se pudo resolver un numero real -- devolvemos el JID tal cual
  // (sera un @lid), que sigue siendo un identificador valido y estable
  // para esa persona, solo que no es su numero de telefono.
  return participanteId;
}

module.exports = { resolverJidReal, conTimeout };

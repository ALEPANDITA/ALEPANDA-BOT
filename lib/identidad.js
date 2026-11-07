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

// ---- Saber si dos ids son la MISMA persona (juegos de 2 personas: 3 en raya, ppt...) ----
// El mismo usuario puede llegar como "numero@s.whatsapp.net" o como "xxxx@lid" (y quien lo menciona suele traer el otro
// formato), asi que comparar el numero a secas deja fuera al segundo jugador. Aqui se prueba en orden: numero igual
// -> ficha del grupo (id / lid / phoneNumber) -> mapeo lid<->numero de Baileys.
const numeroDeId = (v) => String(v || '').split('@')[0].split(':')[0];

// Todos los ids con los que puede venir quien escribio el mensaje (el @lid y, si WhatsApp lo da, su numero real)
function idsDeRemitente(msg) {
  const k = (msg && msg.key) || {};
  const ids = [k.participant, k.participantPn];
  if (k.remoteJid && !String(k.remoteJid).endsWith('@g.us')) ids.push(k.remoteJid);
  return ids.filter(Boolean);
}

// Comparacion rapida, sin consultar nada: ¿comparten algun numero?
function mismoNumero(a, b) {
  const nb = new Set([].concat(b).filter(Boolean).map(numeroDeId));
  return [].concat(a).filter(Boolean).some((x) => nb.has(numeroDeId(x)));
}

// a y b pueden ser un id o un arreglo de ids. Devuelve true si son la misma persona.
async function mismaPersona(sock, jid, a, b, metadata = null) {
  const A = [].concat(a).filter(Boolean);
  const B = [].concat(b).filter(Boolean);
  if (!A.length || !B.length) return false;
  if (mismoNumero(A, B)) return true;
  if (!String(jid).endsWith('@g.us')) return false;

  let meta = metadata;
  if (!meta) { try { meta = await conTimeout(sock.groupMetadata(jid), 4000, null); } catch (_) { meta = null; } }

  const numsA = A.map(numeroDeId);
  const numsB = B.map(numeroDeId);
  const idsFicha = (p) => [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map(numeroDeId);
  if (meta && Array.isArray(meta.participants)) {
    const ficha = meta.participants.find((p) => idsFicha(p).some((n) => numsA.includes(n)));
    if (ficha && idsFicha(ficha).some((n) => numsB.includes(n))) return true;
  }

  try {
    const ra = await Promise.all(A.map((x) => resolverJidReal(sock, x, meta)));
    const rb = await Promise.all(B.map((x) => resolverJidReal(sock, x, meta)));
    if (mismoNumero(ra, rb)) return true;
  } catch (_) { /* sin mapeo: se queda en "no es la misma" */ }
  return false;
}

module.exports = { resolverJidReal, conTimeout, mismaPersona, mismoNumero, idsDeRemitente, numeroDeId };

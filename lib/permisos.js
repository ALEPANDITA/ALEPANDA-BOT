const { SUPER_OWNER } = require('./superowner');

// Nunca dejamos una promesa de red sin limite de tiempo: si no responde en
// `ms`, seguimos con `valorTimeout` en vez de quedarnos colgados para siempre.
function conTimeout(promesa, ms, valorTimeout) {
  return new Promise((resolve) => {
    const temporizador = setTimeout(() => resolve(valorTimeout), ms);
    Promise.resolve(promesa).then(
      (valor) => { clearTimeout(temporizador); resolve(valor); },
      () => { clearTimeout(temporizador); resolve(valorTimeout); }
    );
  });
}

async function resolverLid(sock, id) {
  if (!id) return id;
  let resuelto = id;
  try {
    const info = await conTimeout(sock.onWhatsApp(id), 3000, null);
    if (info?.[0]?.lid) resuelto = info[0].lid;
  } catch (e) {}
  return resuelto;
}

function mismoUsuario(idA, idB) {
  if (!idA || !idB) return false;
  return idA.split('@')[0] === idB.split('@')[0];
}

function buscarParticipante(metadata, idOriginal, idResuelto) {
  const numOriginal = idOriginal.split('@')[0];
  const numResuelto = idResuelto.split('@')[0];

  return metadata.participants.find(p => {
    const pId = (p.id || '').split('@')[0];
    const pPhone = (p.phoneNumber || '').split('@')[0];
    return pId === numOriginal || pPhone === numOriginal || pId === numResuelto || pPhone === numResuelto;
  });
}

// ¿Es el SUPER OWNER del bot? (el desarrollador). Primero compara sin red (numero, telefono o @lid del participante del grupo);
// solo si no coincide nada resuelve su numero a @lid como ultimo recurso. msg es opcional: aporta participantAlt/participantPn.
async function esSuperOwnerDe(sock, { ids = [], participante = null, msg = null } = {}) {
  const conocidos = [...ids, participante?.id, participante?.jid, participante?.lid, participante?.phoneNumber].filter(Boolean);
  if (conocidos.some((c) => mismoUsuario(c, SUPER_OWNER))) return true;
  if (msg && (await coincideConAlguno(sock, candidatosDe(msg), [SUPER_OWNER]))) return true;
  const lid = await resolverLid(sock, SUPER_OWNER);
  return !!lid && lid !== SUPER_OWNER && conocidos.some((c) => mismoUsuario(c, lid));
}

// esAdmin = admin del grupo O super owner (el super owner pasa por todos los chequeos de admin, aunque no sea admin del grupo).
// esAdminReal = si de verdad es admin del grupo en WhatsApp. msg es opcional (ayuda a reconocer al super owner con @lid).
async function esAdminDelGrupo(sock, jid, remitente, msg = null) {
  const metadata = await sock.groupMetadata(jid);
  const remitenteResuelto = await resolverLid(sock, remitente);
  const participante = buscarParticipante(metadata, remitente, remitenteResuelto);
  const esAdminReal = !!participante?.admin;
  const esSuperOwner = await esSuperOwnerDe(sock, { ids: [remitente, remitenteResuelto], participante, msg });
  return { metadata, esAdmin: esAdminReal || esSuperOwner, esAdminReal, esSuperOwner, participante };
}

async function esAdminDelBot(sock, jid) {
  const metadata = await sock.groupMetadata(jid);
  const botId = sock.user.id.replace(/:\d+/, '');
  const botResuelto = await resolverLid(sock, botId);
  const participante = buscarParticipante(metadata, botId, botResuelto);
  return !!participante?.admin;
}

function candidatosDe(msg) {
  // pushName (el nombre visible) nunca es un identificador valido, se quita
  // para no perder tiempo tratando de resolverlo como si fuera un JID.
  return [
    msg.key?.participant,
    msg.key?.participantAlt,
    msg.key?.participantPn,
    msg.key?.remoteJid,
    msg.key?.remoteJidAlt,
    msg.participant,
    msg.sender
  ].filter(Boolean);
}

async function coincideConAlguno(sock, candidatosRaw, listaObjetivos) {
  // Paso 1: comparacion directa, SIN llamadas de red. Cubre la gran mayoria
  // de los casos (el numero ya viene en el mismo formato de ambos lados),
  // y es instantaneo.
  for (const candidato of candidatosRaw) {
    for (const objetivo of listaObjetivos) {
      if (mismoUsuario(candidato, objetivo)) return true;
    }
  }

  // Paso 2: solo si el paso 1 no encontro nada, resolvemos los @lid contra
  // WhatsApp -- en paralelo (no uno por uno) y con timeout, para que como
  // maximo tarde ~3 segundos en total, nunca se quede colgado para siempre.
  const [candidatosResueltos, objetivosResueltos] = await Promise.all([
    Promise.all(candidatosRaw.map(c => resolverLid(sock, c))),
    Promise.all(listaObjetivos.map(o => resolverLid(sock, o)))
  ]);

  for (const candidatoResuelto of candidatosResueltos) {
    for (const objetivo of listaObjetivos) {
      if (mismoUsuario(candidatoResuelto, objetivo)) return true;
    }
  }
  for (const candidato of candidatosRaw) {
    for (const objetivoResuelto of objetivosResueltos) {
      if (mismoUsuario(candidato, objetivoResuelto)) return true;
    }
  }
  for (const candidatoResuelto of candidatosResueltos) {
    for (const objetivoResuelto of objetivosResueltos) {
      if (mismoUsuario(candidatoResuelto, objetivoResuelto)) return true;
    }
  }

  return false;
}

async function esOwnerBot(sock, config, msg) {
  const owners = [...(config.owners || []), SUPER_OWNER];
  return coincideConAlguno(sock, candidatosDe(msg), owners);
}

async function esSuperOwnerBot(sock, msg) {
  return coincideConAlguno(sock, candidatosDe(msg), [SUPER_OWNER]);
}

module.exports = { esAdminDelGrupo, esAdminDelBot, esSuperOwnerDe, resolverLid, mismoUsuario, esOwnerBot, esSuperOwnerBot, SUPER_OWNER };

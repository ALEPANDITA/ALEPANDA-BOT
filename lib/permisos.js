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

async function esAdminDelGrupo(sock, jid, remitente) {
  const metadata = await sock.groupMetadata(jid);
  const remitenteResuelto = await resolverLid(sock, remitente);
  const participante = buscarParticipante(metadata, remitente, remitenteResuelto);
  return { metadata, esAdmin: !!participante?.admin, participante };
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

module.exports = { esAdminDelGrupo, esAdminDelBot, resolverLid, mismoUsuario, esOwnerBot, esSuperOwnerBot, SUPER_OWNER };

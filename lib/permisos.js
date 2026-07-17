const { SUPER_OWNER } = require('./superowner');

async function resolverLid(sock, id) {
  let resuelto = id;
  try {
    const [info] = await sock.onWhatsApp(id);
    if (info?.lid) resuelto = info.lid;
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
  return [
    msg.key?.participant,
    msg.key?.participantAlt,
    msg.key?.participantPn,
    msg.key?.remoteJid,
    msg.key?.remoteJidAlt,
    msg.participant,
    msg.sender,
    msg.pushName
  ].filter(Boolean);
}

async function coincideConAlguno(sock, candidatosRaw, listaObjetivos) {
  for (const candidato of candidatosRaw) {
    let candidatoResuelto = candidato;
    try {
      candidatoResuelto = await resolverLid(sock, candidato);
    } catch (e) {}

    for (const objetivo of listaObjetivos) {
      let objetivoResuelto = objetivo;
      try {
        objetivoResuelto = await resolverLid(sock, objetivo);
      } catch (e) {}

      if (
        mismoUsuario(candidato, objetivo) ||
        mismoUsuario(candidatoResuelto, objetivo) ||
        mismoUsuario(candidato, objetivoResuelto) ||
        mismoUsuario(candidatoResuelto, objetivoResuelto)
      ) {
        return true;
      }
    }
  }
  return false;
}

async function esOwnerBot(sock, config, msg) {
  const owners = [...(config.owners || []), SUPER_OWNER];
  console.log('DEBUG OWNER - candidatos:', JSON.stringify(candidatosDe(msg)));
  console.log('DEBUG OWNER - owners esperados:', JSON.stringify(owners));
  return coincideConAlguno(sock, candidatosDe(msg), owners);
}

async function esSuperOwnerBot(sock, msg) {
  return coincideConAlguno(sock, candidatosDe(msg), [SUPER_OWNER]);
}

module.exports = { esAdminDelGrupo, esAdminDelBot, resolverLid, mismoUsuario, esOwnerBot, esSuperOwnerBot, SUPER_OWNER };

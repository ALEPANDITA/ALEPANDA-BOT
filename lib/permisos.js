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

// Verificacion robusta de owner: revisa varios candidatos del remitente
// (participant, remoteJid, sender, pushName) contra cada owner guardado,
// con y sin resolucion de LID, en todas las combinaciones.
async function esOwnerBot(sock, config, msg) {
  const owners = config.owners || [];

  const candidatosRaw = [
    msg.key?.participant,
    msg.key?.remoteJid,
    msg.participant,
    msg.sender,
    msg.pushName
  ].filter(Boolean);

  for (const candidato of candidatosRaw) {
    let candidatoResuelto = candidato;
    try {
      candidatoResuelto = await resolverLid(sock, candidato);
    } catch (e) {}

    for (const owner of owners) {
      let ownerResuelto = owner;
      try {
        ownerResuelto = await resolverLid(sock, owner);
      } catch (e) {}

      if (
        mismoUsuario(candidato, owner) ||
        mismoUsuario(candidatoResuelto, owner) ||
        mismoUsuario(candidato, ownerResuelto) ||
        mismoUsuario(candidatoResuelto, ownerResuelto)
      ) {
        return true;
      }
    }
  }

  return false;
}

module.exports = { esAdminDelGrupo, esAdminDelBot, resolverLid, mismoUsuario, esOwnerBot };

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

module.exports = { esAdminDelGrupo, esAdminDelBot, resolverLid, mismoUsuario };

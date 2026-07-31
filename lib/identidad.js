// En grupos con la privacidad de numero activada, WhatsApp puede identificar
// a una misma persona con formatos distintos segun el contexto: a veces un
// LID (@lid), a veces su numero real (@s.whatsapp.net). Si un comando guarda
// datos usando el ID que viene de "mencionar" a alguien, y otro comando lee
// esos datos usando el ID que trae msg.key.participant, pueden no coincidir
// aunque sean la misma persona -- y entonces parece que "no se guardo nada".
//
// Esta funcion resuelve un ID cualquiera al ID canonico que usa el grupo
// para ese participante (metadata.participants[].id), comparando por numero
// de telefono. Asi, cualquier comando que la use guarda/lee siempre con el
// mismo ID que el resto del bot (ej: el contador de actividad/XP en index.js,
// o topnivel.js).
async function resolverIdEnGrupo(sock, jid, idCrudo) {
  if (!idCrudo || !jid.endsWith('@g.us')) return idCrudo;

  try {
    const metadata = await sock.groupMetadata(jid);
    const numeroCrudo = idCrudo.split('@')[0];

    const encontrado = metadata.participants.find(p => {
      const pId = (p.id || '').split('@')[0];
      const pPhone = (p.phoneNumber || '').split('@')[0];
      return pId === numeroCrudo || pPhone === numeroCrudo;
    });

    if (encontrado?.id) return encontrado.id;
  } catch (e) {
    // Si falla la resolucion, seguimos con el ID original en vez de tronar.
  }

  return idCrudo;
}

module.exports = { resolverIdEnGrupo };

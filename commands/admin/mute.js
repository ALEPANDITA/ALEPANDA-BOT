const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { resolverJidReal } = require('../../lib/identidad');

async function cambiarMute(sock, jid, msg, accion) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant || msg.key.remoteJid;
  const participante = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente);

  if (!participante?.admin) {
    return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
  }

  const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
  const objetivoCrudo = mencionado || citado;

  if (!objetivoCrudo) {
    return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con este comando.' });
  }

  // Mismo identificador que usa el handler de mensajes para revisar el mute
  // -- si no coinciden, el mute se guarda pero nunca se detecta despues.
  const objetivo = await resolverJidReal(sock, objetivoCrudo, metadata);

  // .unmute solo avisa que desmuteo, pero NO quita el mute (a proposito): la unica
  // forma real de desmutear es .unmuteall.
  // El mute es solo de ESTE grupo.
  if (accion === 'mute') {
    const db = leerDB();
    const grupo = getGrupo(db, jid);
    if (!grupo.muteados) grupo.muteados = {};
    grupo.muteados[objetivo] = true;
    guardarDB(db);
  }

  const texto = accion === 'mute' ? 'Usuario muteado. Sus mensajes seran borrados.' : 'Usuario desmuteado.';
  await sock.sendMessage(jid, { text: texto });
}

module.exports = [
  {
    name: 'mute',
    category: 'admin',
    description: 'Mutear usuario',
    groupOnly: true,
    execute: (sock, jid, msg) => cambiarMute(sock, jid, msg, 'mute')
  },
  {
    name: 'unmute',
    category: 'admin',
    description: 'Desmutear usuario',
    groupOnly: true,
    execute: (sock, jid, msg) => cambiarMute(sock, jid, msg, 'unmute')
  }
];

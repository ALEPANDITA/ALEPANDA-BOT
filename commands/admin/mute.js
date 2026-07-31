const { leerDB, guardarDB, getUsuario } = require('../../lib/db');

async function cambiarMute(sock, jid, msg, accion) {
  const metadata = await sock.groupMetadata(jid);
  const remitente = msg.key.participant || msg.key.remoteJid;
  const participante = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente);

  if (!participante?.admin) {
    return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
  }

  const mencionado = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
  const objetivo = mencionado || citado;

  if (!objetivo) {
    return sock.sendMessage(jid, { text: 'Menciona a alguien o responde su mensaje con este comando.' });
  }

  const db = leerDB();
  const usuario = getUsuario(db, objetivo);
  usuario.muteado = accion === 'mute';
  guardarDB(db);

  const texto = accion === 'mute' ? 'Usuario muteado. Sus mensajes seran borrados.' : 'Usuario desmuteado.';
  await sock.sendMessage(jid, { text });
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

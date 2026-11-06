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

  // El mute es solo de ESTE grupo.
  const db = leerDB();
  const grupo = getGrupo(db, jid);
  if (!grupo.muteados) grupo.muteados = {};

  if (accion === 'mute') {
    grupo.muteados[objetivo] = true;
    guardarDB(db);
    return sock.sendMessage(jid, { text: 'Usuario muteado. Sus mensajes seran borrados.' });
  }

  // unmute: quita todas las llaves que sean de la misma persona (mismo numero/lid),
  // por si el mute quedo guardado con otro formato de JID.
  const numeroDe = (j) => String(j || '').split('@')[0].split(':')[0];
  const numeros = new Set([numeroDe(objetivo), numeroDe(objetivoCrudo)]);
  // Si el grupo conoce a la persona con varios identificadores (@lid, numero real), se usan todos
  const idsDe = (p) => [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean);
  const info = metadata.participants.find(p => idsDe(p).some(x => numeros.has(numeroDe(x))));
  if (info) for (const x of idsDe(info)) numeros.add(numeroDe(x));
  let quito = false;
  for (const llave of Object.keys(grupo.muteados)) {
    if (numeros.has(numeroDe(llave))) {
      delete grupo.muteados[llave];
      quito = true;
    }
  }

  if (!quito) {
    return sock.sendMessage(jid, { text: 'Ese usuario no estaba muteado en este grupo.' });
  }
  guardarDB(db);
  await sock.sendMessage(jid, { text: 'Usuario desmuteado.' });
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

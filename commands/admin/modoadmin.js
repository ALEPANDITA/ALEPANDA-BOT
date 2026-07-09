const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');

module.exports = {
  name: 'modoadmin',
  category: 'admin',
  description: 'Activa/desactiva modo solo-admins (ej: .modoadmin on/off)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;

    const metadata = await sock.groupMetadata(jid);
    const participanteEncontrado = metadata.participants.find(
      p => p.jid === remitente || p.id === remitente || p.lid === remitente
    );

    const esAdmin = !!participanteEncontrado?.admin;
    const esOwner = !!(config.owners && participanteEncontrado &&
      (config.owners.includes(participanteEncontrado.id) || config.owners.includes(participanteEncontrado.lid)));

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    const valor = texto.slice((prefix + 'modoadmin ').length).trim().toLowerCase();
    const db = leerDB();
    const grupo = getGrupo(db, jid);

    if (valor === 'on') {
      grupo.soloAdmins = true;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '🔒 Modo solo-admins activado. Solo admins y owners del bot podran usar comandos aqui.' });
    }
    if (valor === 'off') {
      grupo.soloAdmins = false;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '🔓 Modo solo-admins desactivado. Todos pueden usar comandos.' });
    }

    await sock.sendMessage(jid, { text: `Uso: ${prefix}modoadmin on/off` });
  }
};

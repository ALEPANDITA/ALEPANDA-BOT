const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');

module.exports = {
  name: 'niveles',
  category: 'admin',
  description: 'Activa/desactiva el sistema de niveles (ej: .niveles on/off)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const config = leerConfig();
    const remitente = msg.key.participant;
    const esOwner = await esOwnerBot(sock, config, msg);

    const metadata = await sock.groupMetadata(jid);
    const esAdmin = metadata.participants.find(p => p.jid === remitente || p.id === remitente || p.lid === remitente)?.admin;

    if (!esAdmin && !esOwner) {
      return sock.sendMessage(jid, { text: 'Solo un admin o un owner del bot puede usar este comando.' });
    }

    const valor = texto.slice((prefix + 'niveles ').length).trim().toLowerCase();
    const db = leerDB();
    const grupo = getGrupo(db, jid);

    if (valor === 'on') {
      grupo.niveles = true;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '📈 Sistema de niveles activado en este grupo.' });
    }
    if (valor === 'off') {
      grupo.niveles = false;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '📉 Sistema de niveles desactivado en este grupo.' });
    }

    await sock.sendMessage(jid, { text: `Uso: ${prefix}niveles on/off` });
  }
};

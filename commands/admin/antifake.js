const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'antifake',
  category: 'admin',
  description: 'Activar/desactivar antifake (expulsa numeros de paises no permitidos). Uso: .antifake on/off, .antifake paises 52,51',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const partes = (texto || '').trim().split(/\s+/);
    const sub = (partes[1] || '').toLowerCase();

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    if (sub === 'paises') {
      const codigos = (partes[2] || '').split(',').map(c => c.trim()).filter(Boolean);
      if (!codigos.length) {
        return sock.sendMessage(jid, { text: `Uso: ${prefix}antifake paises 52,51 (codigos de pais separados por coma)` });
      }
      grupo.paisesPermitidos = codigos;
      guardarDB(db);
      return sock.sendMessage(jid, { text: `✅ Codigos de pais permitidos: ${codigos.join(', ')}` });
    }

    grupo.antifake = !grupo.antifake;
    if (!grupo.paisesPermitidos) grupo.paisesPermitidos = ['52', '51'];
    guardarDB(db);

    const texto2 = grupo.antifake
      ? `Antifake activado. Se expulsara a quien se una con un numero fuera de: ${grupo.paisesPermitidos.join(', ')}.\nCambia la lista con ${prefix}antifake paises 52,51,1`
      : 'Antifake desactivado.';
    await sock.sendMessage(jid, { text: texto2 });
  }
};

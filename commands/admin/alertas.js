const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'alertas',
  aliases: ['alerts', 'avisos'],
  category: 'admin',
  description: 'Activa o desactiva los avisos del grupo (cambios de nombre, ajustes, icono, link y admins degradados). Uso: .alertas on/off (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' }, { quoted: msg });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const opcion = (texto.trim().split(/\s+/)[1] || '').toLowerCase();

    if (['on', 'si', 'activar', '1'].includes(opcion)) {
      if (grupo.alertas) return sock.sendMessage(jid, { text: 'Las alertas ya estaban activadas.' }, { quoted: msg });
      grupo.alertas = true;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '🔔 Alertas activadas. Avisare cuando cambien el nombre, los ajustes, el icono o el link del grupo, o cuando degraden a un admin.' }, { quoted: msg });
    }

    if (['off', 'no', 'desactivar', '0'].includes(opcion)) {
      if (!grupo.alertas) return sock.sendMessage(jid, { text: 'Las alertas ya estaban desactivadas.' }, { quoted: msg });
      grupo.alertas = false;
      guardarDB(db);
      return sock.sendMessage(jid, { text: '🔕 Alertas desactivadas.' }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `🔔 Alertas: *${grupo.alertas ? 'ACTIVADAS' : 'DESACTIVADAS'}*\nUso: ${prefix}alertas on  |  ${prefix}alertas off`
    }, { quoted: msg });
  }
};

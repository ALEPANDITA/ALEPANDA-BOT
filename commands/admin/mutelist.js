const { leerDB, getGrupo } = require('../../lib/db');
const { esAdminDelGrupo } = require('../../lib/permisos');

module.exports = {
  name: 'mutelist',
  aliases: ['listmute', 'silenciados', 'muteds'],
  category: 'admin',
  description: 'Lista a los usuarios muteados en este grupo (solo admin)',
  groupOnly: true,
  execute: async (sock, jid, msg) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' }, { quoted: msg });
    }

    const grupo = getGrupo(leerDB(), jid);
    const ids = Object.keys(grupo.muteados || {}).filter((id) => grupo.muteados[id]);

    if (ids.length === 0) {
      return sock.sendMessage(jid, { text: 'No hay nadie muteado en este grupo.' }, { quoted: msg });
    }

    const lineas = ids.map((id) => `🔇 @${id.split('@')[0]}`);
    await sock.sendMessage(jid, {
      text: `*MUTEADOS EN ESTE GRUPO*\n\n${lineas.join('\n')}\n\nTotal: ${ids.length}`,
      mentions: ids
    }, { quoted: msg });
  }
};

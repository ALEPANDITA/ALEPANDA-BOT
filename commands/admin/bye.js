const { leerDB, guardarDB, getGrupo } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');
const { esAdminDelGrupo, esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia, info } = require('../../lib/estilo');

// Activa o desactiva SOLO la despedida (.welcome on/off prende o apaga bienvenida y despedida juntas).
module.exports = {
  name: 'bye',
  aliases: ['despedida'],
  category: 'admin',
  description: 'Activa o desactiva la despedida del grupo (solo admin). Uso: .bye on / .bye off',
  groupOnly: true,
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    if (!esAdmin && !(await esOwnerBot(sock, leerConfig(), msg))) {
      return sock.sendMessage(jid, { text: advertencia('Solo un admin o un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS' }) }, { quoted: msg });
    }

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const valor = (texto.trim().split(/\s+/)[1] || '').toLowerCase();
    const prender = ['on', '1', 'si', 'activar', 'encender'].includes(valor);
    const apagar = ['off', '0', 'no', 'desactivar', 'apagar'].includes(valor);

    if (!prender && !apagar) {
      return sock.sendMessage(jid, {
        text: info(`La despedida esta *${grupo.despedida ? 'ACTIVADA' : 'DESACTIVADA'}* en este grupo.\n\nUso: ${prefix}bye on  |  ${prefix}bye off\nProbar el mensaje: ${prefix}testbye`, { titulo: 'DESPEDIDA' })
      }, { quoted: msg });
    }

    if (grupo.despedida === prender) {
      return sock.sendMessage(jid, { text: `La despedida ya estaba ${prender ? 'activada' : 'desactivada'}.` }, { quoted: msg });
    }

    grupo.despedida = prender;
    guardarDB(db);
    await sock.sendMessage(jid, {
      text: exito(prender ? 'Despedida activada. Avisare cuando alguien salga del grupo.' : 'Despedida desactivada.', { titulo: 'DESPEDIDA' })
    }, { quoted: msg });
  }
};

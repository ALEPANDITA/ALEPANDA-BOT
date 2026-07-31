const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { leerDB, guardarDB } = require('../../lib/db');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'resetniveles',
  category: 'owner',
  description: 'Borra toda la xp/niveles guardados de todos los usuarios (empezar de cero, ej. tras corregir un bug de IDs)',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, {
        text: advertencia('Solo un owner del bot puede reiniciar los niveles.', { titulo: 'SIN PERMISOS' })
      });
    }

    const db = leerDB();
    let afectados = 0;
    for (const id of Object.keys(db.usuarios || {})) {
      const usuario = db.usuarios[id];
      if (usuario.xp || usuario.lastXp) {
        usuario.xp = 0;
        usuario.lastXp = 0;
        afectados++;
      }
    }
    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(`Se reinicio la xp/nivel de *${afectados}* usuario(s). Todos vuelven a empezar desde nivel 0.`, { titulo: 'NIVELES REINICIADOS' })
    });
  }
};

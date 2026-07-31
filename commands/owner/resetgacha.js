const { leerDB, guardarDB } = require('../../lib/db');
const { leerConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { exito, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'resetgacha',
  category: 'owner',
  description: 'Reinicia el cooldown y los pendientes de reclamo del gacha HP y del gacha anime (solo owner).',
  execute: async (sock, jid, msg) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);

    if (!autorizado) {
      return sock.sendMessage(jid, {
        text: advertencia('Solo un owner del bot puede usar este comando.', { titulo: 'SIN PERMISOS', estilo: 'neon' })
      });
    }

    const db = leerDB();
    let afectados = 0;

    for (const id in db.usuarios) {
      const perfil = db.usuarios[id];
      let tocado = false;

      if (perfil.lastGachaHP || perfil.pendingGachaHP) {
        perfil.lastGachaHP = 0;
        delete perfil.pendingGachaHP;
        tocado = true;
      }

      if (perfil.lastGachaAnime || perfil.pendingGachaAnime) {
        perfil.lastGachaAnime = 0;
        delete perfil.pendingGachaAnime;
        tocado = true;
      }

      if (tocado) afectados++;
    }

    guardarDB(db);

    await sock.sendMessage(jid, {
      text: exito(
        `Se reinicio el cooldown de *gacha HP* y *gacha anime* para todos los usuarios.\n\nUsuarios afectados: ${afectados}`,
        { titulo: 'GACHA REINICIADO', estilo: 'neon' }
      )
    }, { quoted: msg });
  }
};

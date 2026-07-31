const { leerConfig, guardarConfig } = require('../../lib/config');
const { esOwnerBot } = require('../../lib/permisos');
const { caja } = require('../../lib/estilo');

module.exports = {
  name: 'setpelisgrupo',
  category: 'owner',
  description: 'Solo owner: fija el grupo donde el bot cataloga peliculas. Se usa DENTRO de ese grupo.',
  execute: async (sock, jid, msg, { prefix }) => {
    const config = leerConfig();
    const autorizado = await esOwnerBot(sock, config, msg);
    if (!autorizado) {
      return sock.sendMessage(jid, { text: 'Solo un owner del bot puede usar este comando.' }, { quoted: msg });
    }

    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, {
        text: caja(['Este comando se usa DENTRO del grupo que quieres usar para peliculas, no en privado.'], { titulo: 'SETPELISGRUPO', estilo: 'gamer' })
      });
    }

    config.grupoPelis = jid;
    guardarConfig(config);

    await sock.sendMessage(jid, {
      text: caja(
        [
          'Este grupo ahora es el grupo base de peliculas.',
          'Cualquier video que se suba aqui se cataloga automaticamente.',
          `Usa "${prefix}pelis" en cualquier grupo para pedirlas.`
        ],
        { titulo: '🎬 GRUPO DE PELICULAS FIJADO', estilo: 'gamer' }
      )
    });
  }
};

const { leerDB, getUsuario } = require('../../lib/db');
const { caja, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'harem',
  category: 'gacha',
  description: 'Ver los personajes que has coleccionado',
  execute: async (sock, jid, msg) => {
    const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const remitente = msg.key.participant || msg.key.remoteJid;
    const objetivo = mencionado || remitente;

    const db = leerDB();
    const usuario = getUsuario(db, objetivo);

    if (!usuario.waifus.length) {
      return sock.sendMessage(jid, {
        text: advertencia('No has reclamado ningun personaje todavia. Usa .rollwaifu para tirar.', { titulo: 'HAREM VACIO' })
      });
    }

    const orden = { LEGENDARIA: 0, EPICA: 1, RARA: 2, COMUN: 3 };
    const emojis = { LEGENDARIA: '🌟', EPICA: '💜', RARA: '💙', COMUN: '⚪' };

    const ordenados = [...usuario.waifus].sort((a, b) => orden[a.rareza] - orden[b.rareza]);

    const lineas = ordenados.map((w, i) =>
      `${i + 1}. ${emojis[w.rareza] || '⚪'} *${w.nombre}* — ${w.serie}`
    );

    const texto = caja(lineas, { titulo: `HAREM (${usuario.waifus.length})`, pie: 'ALEPANDA GACHA' });
    await sock.sendMessage(jid, { text: texto, mentions: [objetivo] });
  }
};

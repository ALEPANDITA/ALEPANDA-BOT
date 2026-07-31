const { leerDB } = require('../../lib/db');

module.exports = {
  name: 'toptrivia',
  category: 'fun',
  description: 'Muestra el ranking de trivia del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    const idsGrupo = metadata.participants.map((p) => p.id);
    const lista = [];

    for (const id of idsGrupo) {
      const usuario = db.usuarios[id];
      if (usuario && (usuario.triviaVictorias || 0) > 0) {
        lista.push({
          id,
          victorias: usuario.triviaVictorias || 0,
          puntos: usuario.triviaPuntos || 0
        });
      }
    }

    if (!lista.length) {
      return sock.sendMessage(jid, { text: 'Todavia nadie ha ganado una trivia en este grupo.' });
    }

    lista.sort((a, b) => b.puntos - a.puntos);
    const top10 = lista.slice(0, 10);

    let texto = `🧠 *TOP TRIVIA* 🧠\n\n`;
    const mentions = [];

    top10.forEach((u, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      texto += `${medalla} @${u.id.split('@')[0]} — ${u.puntos} puntos (${u.victorias} victorias)\n`;
      mentions.push(u.id);
    });

    await sock.sendMessage(jid, { text: texto, mentions });
  }
};

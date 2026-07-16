const { leerDB } = require('../../lib/db');
const { obtenerRango } = require('../../lib/niveles');

module.exports = {
  name: 'topnivel',
  category: 'owner',
  description: 'Muestra el ranking de niveles del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    const idsGrupo = metadata.participants.map(p => p.id);
    const lista = [];

    for (const id of idsGrupo) {
      const usuario = db.usuarios[id];
      if (usuario) {
        lista.push({ id, nivel: usuario.nivel || 1, xp: usuario.xp || 0 });
      }
    }

    if (!lista.length) {
      return sock.sendMessage(jid, { text: 'Todavia no hay datos de actividad en este grupo.' });
    }

    lista.sort((a, b) => b.nivel - a.nivel || b.xp - a.xp);
    const top10 = lista.slice(0, 10);

    let texto = `🏆 *TOP NIVELES DEL GRUPO*\n\n`;
    const mentions = [];

    top10.forEach((u, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      texto += `${medalla} @${u.id.split('@')[0]} — Nivel ${u.nivel} (${obtenerRango(u.nivel)})\n`;
      mentions.push(u.id);
    });

    await sock.sendMessage(jid, { text: texto, mentions });
  }
};

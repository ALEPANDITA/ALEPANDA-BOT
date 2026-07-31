const { leerDB } = require('../../lib/db');

module.exports = {
  name: 'topsaldo',
  category: 'economia',
  description: 'Muestra el ranking de los usuarios con mas dinero del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    const idsGrupo = metadata.participants.map(p => p.id);
    const lista = [];

    for (const id of idsGrupo) {
      const usuario = db.usuarios[id];
      if (usuario) {
        const total = (usuario.saldo || 0) + (usuario.banco || 0);
        lista.push({ id, saldo: usuario.saldo || 0, banco: usuario.banco || 0, total });
      }
    }

    if (!lista.length) {
      return sock.sendMessage(jid, { text: 'Todavia no hay datos economicos en este grupo.' });
    }

    lista.sort((a, b) => b.total - a.total);
    const top10 = lista.slice(0, 10);

    let texto = `💰 *TOP RICOS DEL GRUPO*\n\n`;
    const mentions = [];

    top10.forEach((u, i) => {
      const medalla = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      texto += `${medalla} @${u.id.split('@')[0]} — $${u.total} (mano: $${u.saldo} + banco: $${u.banco})\n`;
      mentions.push(u.id);
    });

    await sock.sendMessage(jid, { text: texto, mentions });
  }
};

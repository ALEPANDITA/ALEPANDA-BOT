const { leerDB, guardarDB, unirIdentidad, claveCanonica } = require('../../lib/db');

module.exports = {
  name: 'topsaldo',
  category: 'economia',
  description: 'Muestra el ranking de los usuarios con mas dinero del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    // Misma identidad unica que usan todos los comandos de economia: se juntan las carteras de cada miembro
    // (su @lid, su numero real...) y se cuenta una sola vez por persona.
    const lista = [];
    const vistos = new Set();
    let cambio = false;
    for (const p of metadata.participants) {
      const ids = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean);
      const antes = JSON.stringify(db.alias_economia || {}) + Object.keys(db.usuarios).length;
      unirIdentidad(db, ids);
      if (antes !== JSON.stringify(db.alias_economia || {}) + Object.keys(db.usuarios).length) cambio = true;
      const llave = claveCanonica(db, p.id);
      if (vistos.has(llave)) continue;
      vistos.add(llave);
      const usuario = db.usuarios[llave];
      if (usuario) {
        const total = (usuario.saldo || 0) + (usuario.banco || 0);
        lista.push({ id: p.id, saldo: usuario.saldo || 0, banco: usuario.banco || 0, total });
      }
    }
    if (cambio) guardarDB(db);

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

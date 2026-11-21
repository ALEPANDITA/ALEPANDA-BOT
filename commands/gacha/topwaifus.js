const { leerDB } = require('../../lib/db');
const { unirIdentidad, claveCanonica, guardarDB } = require('../../lib/db');
const { caja, advertencia } = require('../../lib/estilo');

const PUNTOS_RAREZA = { COMUN: 1, RARA: 3, EPICA: 8, LEGENDARIA: 20 };

module.exports = {
  name: 'topwaifus',
  category: 'gacha',
  description: 'Ranking de los que mas personajes han coleccionado en el grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    const lista = [];
    const vistos = new Set();
    for (const p of metadata.participants) {
      unirIdentidad(db, [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean));
      const llave = claveCanonica(db, p.id);
      if (vistos.has(llave)) continue;
      vistos.add(llave);
      const usuario = db.usuarios[llave];
      if (usuario?.waifus?.length) {
        const puntos = usuario.waifus.reduce((acc, w) => acc + (PUNTOS_RAREZA[w.rareza] || 1), 0);
        lista.push({ id: p.id, cantidad: usuario.waifus.length, puntos });
      }
    }

    guardarDB(db);

    if (!lista.length) {
      return sock.sendMessage(jid, { text: advertencia('Nadie ha coleccionado personajes todavia en este grupo.', { titulo: 'TOP GACHA' }) });
    }

    lista.sort((a, b) => b.puntos - a.puntos);
    const top10 = lista.slice(0, 10);

    const medallas = ['🥇', '🥈', '🥉'];
    const lineas = top10.map((u, i) =>
      `${medallas[i] || `${i + 1}.`} @${u.id.split('@')[0]} — ${u.cantidad} personajes (${u.puntos} pts)`
    );

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: 'TOP COLECCIONISTAS', pie: 'ALEPANDA GACHA' }),
      mentions: top10.map(u => u.id)
    });
  }
};

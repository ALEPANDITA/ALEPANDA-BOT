const { leerDB } = require('../../lib/db');
const { calcularNivel, calcularRango } = require('../../lib/niveles');
const { caja, advertencia } = require('../../lib/estilo');

module.exports = {
  name: 'topnivel',
  category: 'niveles',
  aliases: ['toplevel', 'toprango'],
  description: 'Ranking de los niveles mas altos del grupo',
  groupOnly: true,
  execute: async (sock, jid) => {
    const metadata = await sock.groupMetadata(jid);
    const db = leerDB();

    // IMPORTANTE: recorremos metadata.participants (la lista real y unica de
    // miembros que da WhatsApp para ESTE grupo), nunca las claves sueltas de
    // db.usuarios. Si recorrieramos db.usuarios, una misma persona guardada
    // alguna vez con @lid y otra vez con su numero real (@s.whatsapp.net)
    // apareceria como 2 personas distintas en el ranking -- ese era el bug
    // del sistema anterior.
    const lista = [];
    for (const p of metadata.participants) {
      const usuario = db.usuarios[p.id];
      const xp = usuario?.xp || 0;
      if (xp > 0) {
        lista.push({ id: p.id, xp, nivel: calcularNivel(xp) });
      }
    }

    if (!lista.length) {
      return sock.sendMessage(jid, {
        text: advertencia('Nadie ha ganado niveles todavia en este grupo. ¡Empieza a platicar!', { titulo: 'TOP NIVELES' })
      });
    }

    lista.sort((a, b) => b.xp - a.xp);
    const top10 = lista.slice(0, 10);

    const medallas = ['🥇', '🥈', '🥉'];
    const lineas = top10.map((u, i) =>
      `${medallas[i] || `${i + 1}.`} @${u.id.split('@')[0]} — Nivel ${u.nivel} (${calcularRango(u.nivel)})`
    );

    await sock.sendMessage(jid, {
      text: caja(lineas, { titulo: 'TOP NIVELES' }),
      mentions: top10.map(u => u.id)
    });
  }
};

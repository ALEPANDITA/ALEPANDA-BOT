const { leerDB, getGrupo } = require('../../lib/db');

module.exports = {
  name: 'fantasmas',
  category: 'general',
  description: 'Muestra usuarios inactivos del grupo (ej: .fantasmas 7)',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto }) => {
    const metadata = await sock.groupMetadata(jid);
    const remitente = msg.key.participant || msg.key.remoteJid;
    const quienEscribe = metadata.participants.find(p => p.id === remitente || p.phoneNumber === remitente);

    if (!quienEscribe?.admin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const partes = texto.trim().split(/\s+/);
    const dias = parseInt(partes[1]) || 7;
    const limiteMs = dias * 24 * 60 * 60 * 1000;
    const ahora = Date.now();

    const db = leerDB();
    const grupo = getGrupo(db, jid);
    const actividad = grupo.actividad || {};
    const mensajes = grupo.mensajes || {};
    const botId = sock.user.id.replace(/:\d+/, '');

    const fantasmas = [];

    for (const p of metadata.participants) {
      if (p.id === botId || p.phoneNumber === botId) continue;

      const ultimaActividad = actividad[p.id];
      const inactivo = !ultimaActividad || (ahora - ultimaActividad) > limiteMs;

      if (inactivo) {
        fantasmas.push({ id: p.id, total: mensajes[p.id] || 0 });
      }
    }

    if (!fantasmas.length) {
      return sock.sendMessage(jid, { text: `Nadie lleva mas de ${dias} dias sin hablar. Todos activos.` });
    }

    fantasmas.sort((a, b) => a.total - b.total);

    let texto2 = `👻 *FANTASMAS DEL GRUPO*\n_Sin actividad en los ultimos ${dias} dias:_\n\n`;
    const mentions = [];

    for (const f of fantasmas) {
      texto2 += `▸ @${f.id.split('@')[0]} — ${f.total} mensaje${f.total === 1 ? '' : 's'} en total\n`;
      mentions.push(f.id);
    }

    await sock.sendMessage(jid, { text: texto2, mentions });
  }
};

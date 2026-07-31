const sorteosActivos = new Map();

module.exports = {
  name: 'sorteo',
  category: 'admin',
  description: 'Inicia un sorteo. Uso: .sorteo <minutos> <premio>',
  groupOnly: true,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const { esAdminDelGrupo } = require('../../lib/permisos');
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede iniciar un sorteo.' });
    }

    if (sorteosActivos.has(jid)) {
      return sock.sendMessage(jid, { text: 'Ya hay un sorteo activo en este grupo.' });
    }

    const partes = (texto || '').trim().split(/\s+/);
    const minutos = parseInt(partes[1], 10);
    const premio = partes.slice(2).join(' ');

    if (!minutos || minutos <= 0 || !premio) {
      return sock.sendMessage(jid, { text: `Uso: ${prefix}sorteo <minutos> <premio>` });
    }

    const participantes = new Set();
    const enviado = await sock.sendMessage(jid, {
      text: `🎉 *SORTEO*\n\nPremio: *${premio}*\nDuracion: ${minutos} minuto(s)\n\nReacciona a este mensaje con cualquier emoji para participar!`
    });

    sorteosActivos.set(jid, { participantes, mensajeId: enviado.key.id });

    sock.ev.on('messages.reaction', (reactions) => {
      for (const r of reactions) {
        if (r.key.remoteJid === jid && r.key.id === enviado.key.id) {
          participantes.add(r.key.participant || r.key.remoteJid);
        }
      }
    });

    setTimeout(async () => {
      const sorteo = sorteosActivos.get(jid);
      sorteosActivos.delete(jid);

      const lista = Array.from(sorteo?.participantes || []);
      if (lista.length === 0) {
        return sock.sendMessage(jid, { text: `El sorteo de *${premio}* termino, pero nadie participo.` });
      }

      const ganador = lista[Math.floor(Math.random() * lista.length)];
      await sock.sendMessage(jid, {
        text: `🏆 El sorteo de *${premio}* termino!\n\nGanador: @${ganador.split('@')[0]}`,
        mentions: [ganador]
      });
    }, minutos * 60 * 1000);
  }
};

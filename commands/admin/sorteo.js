const sorteosActivos = new Map();

// "5217712345678:12@s.whatsapp.net" -> "5217712345678" (sin sufijo de dispositivo ni dominio)
const soloNumero = (id) => String(id || '').split('@')[0].split(':')[0];

// En el evento "messages.reaction" de Baileys cada elemento trae DOS claves:
//   - item.key          = el mensaje al que se reacciono (el del sorteo, enviado por el bot)
//   - item.reaction.key = el mensaje de la reaccion en si; su "participant" es QUIEN reacciono
// (antes se leia item.key.participant, que es el autor del sorteo -- el propio bot -- y por eso el
// ganador nunca era alguien que hubiera reaccionado).
// Devuelve { reactor, quito } si la reaccion es al mensaje del sorteo, o null si es de otro mensaje.
function leerReaccion(item, jidGrupo, idSorteo) {
  const claveA = item && item.key;
  const claveB = item && item.reaction && item.reaction.key;
  const esDelSorteo = (k) => !!k && k.id === idSorteo && (!k.remoteJid || k.remoteJid === jidGrupo);

  let claveReaccion = null;
  if (esDelSorteo(claveA) && claveB && !esDelSorteo(claveB)) claveReaccion = claveB;
  else if (esDelSorteo(claveB) && claveA && !esDelSorteo(claveA)) claveReaccion = claveA; // forks que invierten los campos
  if (!claveReaccion) return null;
  if (claveReaccion.fromMe) return null; // la reaccion del propio bot no cuenta

  const reactor = claveReaccion.participant || null; // en un grupo siempre viene quien reacciono
  if (!reactor) return null;
  const texto = item.reaction && typeof item.reaction.text === 'string' ? item.reaction.text : '';
  return { reactor, quito: texto === '' }; // texto vacio = quito su reaccion
}

module.exports = {
  name: 'sorteo',
  category: 'admin',
  description: 'Inicia un sorteo. Uso: .sorteo <minutos> <premio>',
  groupOnly: true,
  _leerReaccion: leerReaccion,
  execute: async (sock, jid, msg, { texto, prefix }) => {
    const { esAdminDelGrupo } = require('../../lib/permisos');
    const { resolverJidReal } = require('../../lib/identidad');
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

    const participantes = new Set(); // JIDs de quienes reaccionaron al mensaje del sorteo
    const enviado = await sock.sendMessage(jid, {
      text: `🎉 *SORTEO*\n\nPremio: *${premio}*\nDuracion: ${minutos} minuto(s)\n\nReacciona a este mensaje con cualquier emoji para participar!`
    });

    const alReaccionar = (reacciones) => {
      for (const item of reacciones || []) {
        const r = leerReaccion(item, jid, enviado.key.id);
        if (!r) continue;
        if (r.quito) participantes.delete(r.reactor);
        else participantes.add(r.reactor);
      }
    };

    sorteosActivos.set(jid, { participantes, mensajeId: enviado.key.id });
    sock.ev.on('messages.reaction', alReaccionar);

    setTimeout(async () => {
      sorteosActivos.delete(jid);
      sock.ev.off('messages.reaction', alReaccionar); // antes el listener se quedaba para siempre

      try {
        let metadata = null;
        try { metadata = await sock.groupMetadata(jid); } catch (_) { /* sin datos del grupo: no se filtra por miembros */ }

        const yoNumero = new Set([soloNumero(sock.user && sock.user.id), soloNumero(sock.user && sock.user.lid)].filter(Boolean));

        // Un mismo usuario puede llegar como @lid o como numero: se unifican y se descartan el bot y quien ya salio del grupo
        const unicos = new Map(); // clave estable -> JID para mencionar
        for (const original of participantes) {
          const real = await resolverJidReal(sock, original, metadata);
          if (yoNumero.has(soloNumero(original)) || yoNumero.has(soloNumero(real))) continue;
          if (metadata && Array.isArray(metadata.participants)) {
            const sigueEnGrupo = metadata.participants.some((p) => [p.id, p.lid, p.phoneNumber].some((x) => x && (soloNumero(x) === soloNumero(original) || soloNumero(x) === soloNumero(real))));
            if (!sigueEnGrupo) continue;
          }
          if (!unicos.has(soloNumero(real))) unicos.set(soloNumero(real), real);
        }

        const lista = [...unicos.values()];
        if (lista.length === 0) {
          return sock.sendMessage(jid, { text: `El sorteo de *${premio}* termino, pero nadie participo.` });
        }

        const ganador = lista[Math.floor(Math.random() * lista.length)];
        await sock.sendMessage(jid, {
          text: `🏆 El sorteo de *${premio}* termino!\n\nParticipantes: ${lista.length}\nGanador: @${soloNumero(ganador)}`,
          mentions: [ganador]
        });
      } catch (err) {
        console.error('[sorteo] error al sortear:', err && err.message ? err.message : err);
        try { await sock.sendMessage(jid, { text: `No pude sortear *${premio}* por un error. Intenta de nuevo.` }); } catch (_) { /* nada mas que hacer */ }
      }
    }, minutos * 60 * 1000);
  }
};

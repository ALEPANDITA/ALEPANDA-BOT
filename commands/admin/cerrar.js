const { esAdminDelGrupo, esAdminDelBot } = require('../../lib/permisos');
const { parsearDuracionCierre, programarApertura, obtenerCierre, cancelarApertura, formatearFecha, formatearDuracion } = require('../../lib/cierre-grupos');

module.exports = {
  name: 'cerrar',
  category: 'admin',
  description: 'Cierra el grupo (solo admins escriben). Con tiempo se abre solo: .cerrar 30m | .cerrar 2h | .cerrar 1h30m | .cerrar 1d | .cerrar tiempo (ver cuanto falta)',
  groupOnly: true,
  execute: async (sock, jid, msg, { prefix = '.', texto = '' }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente);
    const esAdminBot = await esAdminDelBot(sock, jid);

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }
    if (!esAdminBot) {
      return sock.sendMessage(jid, { text: 'Necesito ser admin para hacer esto.' });
    }

    const argumento = String(texto).trim().split(/\s+/).slice(1).join(' ');

    // .cerrar tiempo -> cuanto falta para que se abra solo
    if (/^(tiempo|estado|cuanto|falta)$/i.test(argumento)) {
      const cierre = obtenerCierre(jid);
      if (!cierre) return sock.sendMessage(jid, { text: `Este grupo no tiene una apertura automatica programada.\nEjemplo: ${prefix}cerrar 30m` });
      return sock.sendMessage(jid, { text: `🔒 El grupo se abre solo en ${formatearDuracion(Math.max(0, cierre.vence - Date.now()))} (${formatearFecha(cierre.vence)}).\nPara abrirlo ya: ${prefix}abrir` });
    }

    // .cerrar <tiempo> -> cierra y programa la apertura; sin tiempo -> cierra sin limite como siempre
    let ms = null;
    if (argumento) {
      ms = parsearDuracionCierre(argumento);
      if (!ms) {
        return sock.sendMessage(jid, {
          text: `No entendi el tiempo "${argumento}".\n\nEjemplos:\n▸ ${prefix}cerrar 30m (30 minutos)\n▸ ${prefix}cerrar 2h (2 horas)\n▸ ${prefix}cerrar 1h30m\n▸ ${prefix}cerrar 1d (1 dia)\n\nMinimo 1 minuto, maximo 30 dias. Sin tiempo cierra hasta que alguien use ${prefix}abrir.`
        });
      }
    }

    try {
      await sock.groupSettingUpdate(jid, 'announcement');
    } catch (err) {
      console.error('[cerrar] No pude cerrar', jid, '-', err && err.message ? err.message : err);
      return sock.sendMessage(jid, { text: 'No pude cerrar el grupo. Revisa que siga siendo admin.' });
    }

    if (!ms) {
      const habia = cancelarApertura(jid);
      return sock.sendMessage(jid, { text: `Grupo cerrado. Solo admins pueden escribir.${habia ? '\n(Se cancelo la apertura automatica que habia: se queda cerrado hasta que usen ' + prefix + 'abrir.)' : ''}` });
    }

    const entrada = programarApertura({ jidGrupo: jid, ms, bot: sock.user && sock.user.id, por: remitente });
    await sock.sendMessage(jid, {
      text: `🔒 Grupo cerrado por *${formatearDuracion(ms)}*. Solo admins pueden escribir.\n⏰ Se abre solo el ${formatearFecha(entrada.vence)}.\n\nPara abrirlo antes: ${prefix}abrir`
    });
  }
};

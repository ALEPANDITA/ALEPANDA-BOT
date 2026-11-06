// Alertas de grupo (.alertas on/off): avisa quien cambio el nombre, los ajustes,
// el icono o el link del grupo, y quien degrado a un admin.
const { leerDB, getGrupo } = require('./db');

function userDe(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function esElBot(sock, jid) {
  const bot = userDe(sock.user?.id);
  return !!jid && !!bot && userDe(jid) === bot;
}

// act: un elemento de 'groups.update' ({ id, subject?, announce?, restrict?, icon?..., author? })
function textoCambio(act, actor) {
  const quien = actor ? `@${userDe(actor)}` : 'Un admin';
  if (act.subject) return `📝 ${quien} cambió el nombre del grupo a *${act.subject}*`;
  if (act.announce !== undefined) {
    return `📢 ${quien} cambió los ajustes: ahora ${act.announce ? 'solo los administradores pueden enviar mensajes' : 'todos los miembros pueden enviar mensajes'}.`;
  }
  if (act.restrict !== undefined) {
    return `⚙️ ${quien} cambió los ajustes: ahora ${act.restrict ? 'solo los administradores pueden editar el grupo' : 'todos los miembros pueden editar el grupo'}.`;
  }
  if (act.inviteCode || act.revoke) return `🔗 ${quien} restableció el link del grupo.`;
  if (act.icon) return `🖼️ ${quien} cambió el icono del grupo.`;
  return '';
}

async function alertaCambioGrupo(sock, act) {
  const jid = act?.id;
  if (!jid || !jid.endsWith('@g.us')) return;
  if (!getGrupo(leerDB(), jid).alertas) return;
  if (esElBot(sock, act.author)) return; // los cambios que hace el propio bot no se avisan

  const texto = textoCambio(act, act.author);
  if (!texto) return;
  await sock.sendMessage(jid, { text: texto, mentions: act.author ? [act.author] : [] });
}

async function alertaDegradado(sock, jid, objetivo, autor) {
  if (!getGrupo(leerDB(), jid).alertas) return;
  if (esElBot(sock, autor)) return;
  const mentions = [objetivo, autor].filter(Boolean);
  const por = autor ? ` por @${userDe(autor)}` : '';
  await sock.sendMessage(jid, {
    text: `⬇️ @${userDe(objetivo)} ya no es administrador${por}.`,
    mentions
  });
}

module.exports = { alertaCambioGrupo, alertaDegradado, textoCambio };

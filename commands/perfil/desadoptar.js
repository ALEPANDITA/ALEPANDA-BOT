const { leerDB, guardarDB, getUsuario } = require('../../lib/db');
const { mismoNumero } = require('../../lib/identidad');

const tag = (j) => '@' + String(j || '').split('@')[0].split(':')[0];

// Rompe el vinculo del hijo con TODOS sus padres (y lo saca de la lista de hijos de cada uno)
function desvincular(db, hijo, padreExtra) {
  const perfilHijo = getUsuario(db, hijo);
  const padres = Array.isArray(perfilHijo.padres) ? [...perfilHijo.padres] : [];
  if (padreExtra) padres.push(padreExtra);
  for (const p of padres) {
    const perfil = getUsuario(db, p);
    perfil.hijos = (perfil.hijos || []).filter((h) => !mismoNumero(h, hijo));
  }
  perfilHijo.padres = [];
  return padres;
}

module.exports = {
  name: 'desadoptar',
  aliases: ['quitarhijo', 'eliminarhijo', 'abandonar'],
  category: 'perfil',
  description: 'Quita la adopcion de un hijo/a (menciónalo, responde a su mensaje o usa "todos"). Sin mencionar a nadie, si eres hijo/a, te desvinculas de tus padres.',
  execute: async (sock, jid, msg, { prefix, texto }) => {
    const remitente = msg.key.participant || msg.key.remoteJid;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const objetivo = ctx?.mentionedJid?.[0] || ctx?.participant;
    const arg = String(texto || '').trim().split(/\s+/).slice(1)[0]?.toLowerCase();
    const db = leerDB();
    const yo = getUsuario(db, remitente);
    const responder = (t, menciones = []) => sock.sendMessage(jid, { text: t, mentions: menciones }, { quoted: msg });
    const hijos = Array.isArray(yo.hijos) ? yo.hijos : [];

    // .desadoptar todos
    if (!objetivo && arg === 'todos') {
      if (!hijos.length) return responder('No tienes hijos para quitar.');
      const lista = [...hijos];
      for (const h of lista) desvincular(db, h, remitente);
      yo.hijos = [];
      guardarDB(db);
      return responder(`💔 Quitaste la adopción de ${lista.length} hijo${lista.length === 1 ? '/a' : 's/as'}: ${lista.map(tag).join(', ')}`, lista);
    }

    // .desadoptar @hijo
    if (objetivo) {
      const esHijo = hijos.some((h) => mismoNumero(h, objetivo));
      if (!esHijo) return responder(`${tag(objetivo)} no es tu hijo/a.`, [objetivo]);
      desvincular(db, objetivo, remitente);
      yo.hijos = (yo.hijos || []).filter((h) => !mismoNumero(h, objetivo));
      guardarDB(db);
      return responder(`💔 ${tag(remitente)} quitó la adopción de ${tag(objetivo)}. Ya no son familia.`, [remitente, objetivo]);
    }

    // Sin mencionar: si soy hijo/a, me desvinculo de mis padres
    const padres = Array.isArray(yo.padres) ? [...yo.padres] : [];
    if (padres.length) {
      desvincular(db, remitente);
      guardarDB(db);
      return responder(`💔 ${tag(remitente)} se desvinculó de su familia (${padres.map(tag).join(' y ')}).`, [remitente, ...padres]);
    }

    return responder(
      `👶 *QUITAR ADOPCIÓN*\n\n` +
      `• ${prefix}desadoptar @hijo — quita a un hijo/a (o responde a su mensaje)\n` +
      `• ${prefix}desadoptar todos — quita a todos tus hijos\n` +
      `• ${prefix}desadoptar — si eres hijo/a, te desvinculas de tus padres\n\n` +
      (hijos.length ? `Tus hijos: ${hijos.map(tag).join(', ')}` : 'Ahora mismo no tienes hijos ni padres registrados.'),
      hijos
    );
  }
};

const { leerDB, getGrupo } = require('../../lib/db');
const { resolverJidReal } = require('../../lib/identidad');
const { esAdminDelGrupo } = require('../../lib/permisos');

// "5217712345678:12@s.whatsapp.net" -> "5217712345678" ; "123456@lid" -> "123456"
const soloNumero = (id) => String(id || '').split('@')[0].split(':')[0];

// El bot guarda la actividad con el JID "real" de quien escribe (numero@s.whatsapp.net, o su @lid si no pudo
// resolver el numero), pero la lista de participantes del grupo puede traer a esa misma persona con OTRO formato
// (p.id = @lid, con el numero en p.phoneNumber). Antes se buscaba solo por p.id, no coincidia con nada y TODOS
// salian como fantasmas aunque acabaran de escribir. Aqui se prueban todos los formatos con los que puede estar
// guardada una persona y se toma la actividad mas reciente.
function idsDe(p) {
  const ids = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map(String);
  const extra = [];
  for (const id of ids) {
    if (!id.includes('@')) extra.push(`${id}@s.whatsapp.net`); // phoneNumber sin dominio
  }
  return [...ids, ...extra];
}

// Une lo que hay guardado para esa persona bajo cualquiera de sus identificadores.
// Devuelve { ultima, total } (ultima = 0 si nunca se registro actividad).
function actividadDe(identificadores, actividad, mensajes, indicePorNumero) {
  const llaves = new Set();
  for (const id of identificadores) {
    if (!id) continue;
    if (Object.prototype.hasOwnProperty.call(actividad, id) || Object.prototype.hasOwnProperty.call(mensajes, id)) llaves.add(id);
    for (const k of indicePorNumero.get(soloNumero(id)) || []) llaves.add(k); // mismo numero con distinto sufijo/dispositivo
  }
  let ultima = 0;
  let total = 0;
  for (const k of llaves) {
    if (typeof actividad[k] === 'number' && actividad[k] > ultima) ultima = actividad[k];
    total += Number(mensajes[k]) || 0;
  }
  return { ultima, total };
}

function indexarPorNumero(actividad, mensajes) {
  const indice = new Map();
  for (const k of new Set([...Object.keys(actividad), ...Object.keys(mensajes)])) {
    const n = soloNumero(k);
    if (!indice.has(n)) indice.set(n, []);
    indice.get(n).push(k);
  }
  return indice;
}

// Calcula quienes llevan mas de `limiteMs` sin hablar. Separado del comando para poder probarlo.
async function calcularFantasmas(sock, metadata, grupo, limiteMs, ahora = Date.now()) {
  const actividad = grupo.actividad || {};
  const mensajes = grupo.mensajes || {};
  const indice = indexarPorNumero(actividad, mensajes);
  const yo = new Set([soloNumero(sock.user && sock.user.id), soloNumero(sock.user && sock.user.lid)].filter(Boolean));

  const participantes = (metadata.participants || []).filter((p) => !idsDe(p).some((id) => yo.has(soloNumero(id))));

  // 1) Sin red: con los identificadores que ya trae el grupo
  const resultado = participantes.map((p) => ({ p, ...actividadDe(idsDe(p), actividad, mensajes, indice) }));

  // 2) A quien no se encontro, se intenta resolver su @lid a numero real (en paralelo, con tope de tiempo)
  await Promise.all(resultado.map(async (r) => {
    if (r.ultima) return;
    try {
      const real = await resolverJidReal(sock, r.p.id, metadata);
      if (real && real !== r.p.id) Object.assign(r, actividadDe([...idsDe(r.p), real], actividad, mensajes, indice));
    } catch (_) { /* sin resolver: se queda como esta */ }
  }));

  return resultado
    .filter((r) => !r.ultima || (ahora - r.ultima) > limiteMs)
    .map((r) => ({ id: r.p.id, total: r.total, nuncaHablo: !r.ultima }));
}

module.exports = {
  name: 'fantasmas',
  category: 'admin',
  description: 'Muestra usuarios inactivos del grupo (ej: .fantasmas 7)',
  groupOnly: true,
  _calcularFantasmas: calcularFantasmas,
  execute: async (sock, jid, msg, { texto }) => {
    const metadata = await sock.groupMetadata(jid);
    const remitente = msg.key.participant || msg.key.remoteJid;
    const { esAdmin } = await esAdminDelGrupo(sock, jid, remitente, msg); // incluye al super owner del bot

    if (!esAdmin) {
      return sock.sendMessage(jid, { text: 'Solo un admin puede usar este comando.' });
    }

    const partes = texto.trim().split(/\s+/);
    const dias = parseInt(partes[1]) || 7;
    const limiteMs = dias * 24 * 60 * 60 * 1000;

    const db = leerDB();
    const grupo = getGrupo(db, jid);

    // Sin ningun registro no se puede saber quien es fantasma: antes decia que todos lo eran
    if (!Object.keys(grupo.actividad || {}).length) {
      return sock.sendMessage(jid, { text: '👻 Todavia no tengo registro de actividad de este grupo (el bot cuenta los mensajes desde que esta en el grupo). Intenta de nuevo cuando haya hablado la gente.' });
    }

    const fantasmas = await calcularFantasmas(sock, metadata, grupo, limiteMs);

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
